/**
 * Upload queue. Each file goes up as an R2 multipart upload: one request per
 * 50 MiB part (the zone caps a request at 100 MB), sent with XHR so the UI can
 * show progress. Files upload one at a time; a failed part is retried.
 */
import { useSyncExternalStore } from "react";
import { MAX_FILE_BYTES } from "shared/limits";
import { api } from "./api";
import { mimeFor } from "./format";

export type UploadState = "queued" | "uploading" | "done" | "error" | "cancelled";

export type UploadTask = {
	key: string;
	name: string;
	size: number;
	parentId: string | null;
	sent: number;
	state: UploadState;
	error?: string;
};

type Internal = UploadTask & { file: File; uploadId?: string; xhr?: XMLHttpRequest };

let tasks: Internal[] = [];
let snapshot: UploadTask[] = [];
const listeners = new Set<() => void>();
const doneListeners = new Set<(parentId: string | null) => void>();
let running = false;

function emit() {
	snapshot = tasks.map(({ file: _f, xhr: _x, uploadId: _u, ...t }) => t);
	for (const l of listeners) l();
}

function patch(t: Internal, p: Partial<Internal>) {
	Object.assign(t, p);
	emit();
}

export function useUploads(): UploadTask[] {
	return useSyncExternalStore(
		(l) => {
			listeners.add(l);
			return () => listeners.delete(l);
		},
		() => snapshot,
		() => snapshot,
	);
}

/** Called after each finished file, so the folder view can refresh. */
export function onUploaded(fn: (parentId: string | null) => void) {
	doneListeners.add(fn);
	return () => doneListeners.delete(fn);
}

export function enqueue(files: Iterable<File>, parentId: string | null) {
	for (const file of files) {
		const t: Internal = { key: crypto.randomUUID(), name: file.name, size: file.size, parentId, sent: 0, state: "queued", file };
		if (file.size > MAX_FILE_BYTES) Object.assign(t, { state: "error", error: "Larger than 5 GB" });
		tasks.push(t);
	}
	emit();
	void run();
}

export function cancel(key: string) {
	const t = tasks.find((x) => x.key === key);
	if (!t || t.state === "done") return;
	t.xhr?.abort();
	if (t.uploadId) void api.abortUpload(t.uploadId).catch(() => {});
	patch(t, { state: "cancelled" });
}

export function clearFinished() {
	tasks = tasks.filter((t) => t.state === "queued" || t.state === "uploading");
	emit();
}

function sendPart(t: Internal, partNumber: number, blob: Blob, base: number): Promise<{ partNumber: number; etag: string }> {
	return new Promise((resolve, reject) => {
		const xhr = new XMLHttpRequest();
		t.xhr = xhr;
		xhr.open("PUT", `/api/uploads/${t.uploadId}/parts/${partNumber}`);
		xhr.upload.onprogress = (e) => patch(t, { sent: base + e.loaded });
		xhr.onload = () => {
			if (xhr.status >= 200 && xhr.status < 300) resolve(JSON.parse(xhr.responseText));
			else reject(new Error(safeError(xhr.responseText) || `Upload failed (${xhr.status})`));
		};
		xhr.onerror = () => reject(new Error("Network error"));
		xhr.onabort = () => reject(new Error("cancelled"));
		xhr.send(blob);
	});
}

function safeError(text: string): string {
	try {
		return (JSON.parse(text) as { error?: string }).error ?? "";
	} catch {
		return "";
	}
}

async function uploadOne(t: Internal) {
	patch(t, { state: "uploading", sent: 0 });
	const begin = await api.beginUpload({ parentId: t.parentId, name: t.name, size: t.size, mime: mimeFor(t.file) });
	if ("file" in begin) return;
	t.uploadId = begin.uploadId;
	const parts: Array<{ partNumber: number; etag: string }> = [];
	for (let n = 1; n <= begin.partCount; n++) {
		const start = (n - 1) * begin.partSize;
		const blob = t.file.slice(start, Math.min(start + begin.partSize, t.size));
		for (let attempt = 1; ; attempt++) {
			try {
				parts.push(await sendPart(t, n, blob, start));
				break;
			} catch (e) {
				if ((t.state as UploadState) === "cancelled" || attempt >= 3) throw e;
				await new Promise((r) => setTimeout(r, 1000 * attempt));
			}
		}
	}
	await api.completeUpload(begin.uploadId, parts);
}

async function run() {
	if (running) return;
	running = true;
	try {
		for (let t = tasks.find((x) => x.state === "queued"); t; t = tasks.find((x) => x.state === "queued")) {
			try {
				await uploadOne(t);
				patch(t, { state: "done", sent: t.size });
				for (const fn of doneListeners) fn(t.parentId);
			} catch (e) {
				if ((t.state as UploadState) !== "cancelled") {
					if (t.uploadId) void api.abortUpload(t.uploadId).catch(() => {});
					patch(t, { state: "error", error: (e as Error).message });
				}
			}
		}
	} finally {
		running = false;
	}
}

// Warn before closing the tab mid-upload.
if (typeof window !== "undefined") {
	window.addEventListener("beforeunload", (e) => {
		if (tasks.some((t) => t.state === "uploading" || t.state === "queued")) e.preventDefault();
	});
}
