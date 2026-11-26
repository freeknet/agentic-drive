/**
 * File bytes: R2 multipart uploads in, Range-aware streaming out.
 *
 * Everything here streams; no file is ever held in memory. A part is piped
 * through a FixedLengthStream because R2 needs to know a body's length.
 */
import { MAX_FILE_BYTES, MAX_PARTS, PART_SIZE, partCount, partLength } from "../shared/limits";
import { DriveError, type Item } from "./drive-do";
import { driveStub, type Env } from "./types";

export interface BeginUpload {
	parentId: string | null;
	name: string;
	size: number;
	mime?: string;
	source?: string;
}

export type BeginResult =
	| { uploadId: string; partSize: number; partCount: number }
	| { file: Item };

const fileKey = (id: string) => `files/${id}`;

function cleanMime(mime?: string): string {
	const m = (mime ?? "").trim().toLowerCase();
	return /^[a-z0-9!#$&^_.+-]+\/[a-z0-9!#$&^_.+-]+$/.test(m) ? m : "application/octet-stream";
}

export async function beginUpload(env: Env, b: BeginUpload): Promise<BeginResult> {
	if (!Number.isSafeInteger(b.size) || b.size < 0) throw new DriveError("Invalid size");
	if (b.size > MAX_FILE_BYTES) throw new DriveError(`Files can be up to ${MAX_FILE_BYTES / 1024 ** 3} GB`, 413);
	const drive = driveStub(env);
	const mime = cleanMime(b.mime);
	const id = crypto.randomUUID();
	const key = fileKey(id);
	if (b.size === 0) {
		await env.BUCKET.put(key, new Uint8Array(0), { httpMetadata: { contentType: mime } });
		return { file: await drive.addFile({ parentId: b.parentId, name: b.name, size: 0, mime, key, source: b.source }) };
	}
	const mpu = await env.BUCKET.createMultipartUpload(key, { httpMetadata: { contentType: mime } });
	try {
		await drive.recordUpload({ id, parent_id: b.parentId, name: b.name, size: b.size, mime, r2_key: key, mpu_id: mpu.uploadId });
	} catch (e) {
		await mpu.abort().catch(() => {});
		throw e;
	}
	return { uploadId: id, partSize: PART_SIZE, partCount: partCount(b.size) };
}

export async function uploadPart(
	env: Env,
	uploadId: string,
	partNumber: number,
	body: ReadableStream<Uint8Array> | null,
	contentLength: number,
): Promise<{ partNumber: number; etag: string }> {
	const u = await driveStub(env).getUpload(uploadId);
	if (!u) throw new DriveError("Upload not found", 404);
	if (!Number.isInteger(partNumber) || partNumber < 1 || partNumber > Math.min(MAX_PARTS, partCount(u.size))) {
		throw new DriveError("Invalid part number");
	}
	const expected = partLength(u.size, partNumber);
	if (!body || contentLength !== expected) throw new DriveError(`Part ${partNumber} must be ${expected} bytes`);
	const mpu = env.BUCKET.resumeMultipartUpload(u.r2_key, u.mpu_id);
	const { readable, writable } = new FixedLengthStream(expected);
	const [, part] = await Promise.all([body.pipeTo(writable), mpu.uploadPart(partNumber, readable)]);
	return { partNumber: part.partNumber, etag: part.etag };
}

export async function completeUpload(
	env: Env,
	uploadId: string,
	parts: Array<{ partNumber: number; etag: string }>,
	source?: string,
): Promise<Item> {
	const drive = driveStub(env);
	const u = await drive.getUpload(uploadId);
	if (!u) throw new DriveError("Upload not found", 404);
	const sorted = [...parts].sort((a, b) => a.partNumber - b.partNumber);
	if (sorted.length !== partCount(u.size) || sorted.some((p, i) => p.partNumber !== i + 1)) {
		throw new DriveError("Some parts are missing");
	}
	const mpu = env.BUCKET.resumeMultipartUpload(u.r2_key, u.mpu_id);
	const obj = await mpu.complete(sorted);
	if (obj.size !== u.size) {
		await env.BUCKET.delete(u.r2_key);
		await drive.removeUpload(uploadId);
		throw new DriveError("The uploaded size doesn't match");
	}
	return drive.finishUpload(uploadId, source);
}

export async function abortUpload(env: Env, uploadId: string): Promise<void> {
	const drive = driveStub(env);
	const u = await drive.getUpload(uploadId);
	if (!u) return;
	await env.BUCKET.resumeMultipartUpload(u.r2_key, u.mpu_id).abort().catch(() => {});
	await drive.removeUpload(uploadId);
}

/** Store a whole stream of known size as one object (used for email attachments, well under 100 MB). */
export async function putFile(
	env: Env,
	f: { parentId: string | null; name: string; size: number; mime?: string; body: ReadableStream<Uint8Array>; source?: string },
): Promise<Item> {
	if (f.size > PART_SIZE) throw new DriveError("Too large for a single upload; use a multipart upload");
	const mime = cleanMime(f.mime);
	const key = fileKey(crypto.randomUUID());
	const { readable, writable } = new FixedLengthStream(f.size);
	await Promise.all([f.body.pipeTo(writable), env.BUCKET.put(key, readable, { httpMetadata: { contentType: mime } })]);
	try {
		return await driveStub(env).addFile({ parentId: f.parentId, name: f.name, size: f.size, mime, key, source: f.source });
	} catch (e) {
		await env.BUCKET.delete(key);
		throw e;
	}
}

/** Types a browser could run as a page; never served inline. */
const ACTIVE = /^(text\/html|application\/xhtml\+xml|image\/svg\+xml|text\/xml|application\/xml|text\/javascript|application\/javascript)/;

function contentDisposition(kind: "inline" | "attachment", filename: string): string {
	const ascii = filename.replace(/[^\x20-\x7e]/g, "_").replace(/["\\]/g, "_");
	return `${kind}; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(filename)}`;
}

/**
 * Stream a file's bytes, honouring Range (video seeking, PDF viewers) and
 * If-None-Match. Inline responses get a sandbox CSP so a file can't script
 * this origin; active types are always downloads.
 */
export async function serveFile(env: Env, item: Item, request: Request, opts: { download: boolean }): Promise<Response> {
	if (!item.r2_key) return new Response("Not found", { status: 404 });
	const obj = await env.BUCKET.get(item.r2_key, { range: request.headers, onlyIf: request.headers });
	if (!obj) return new Response("Not found", { status: 404 });
	const mime = item.mime ?? "application/octet-stream";
	const inline = !opts.download && !ACTIVE.test(mime);
	const headers = new Headers({
		"Content-Type": inline ? mime : mime.startsWith("text/") ? "text/plain; charset=utf-8" : mime,
		"Content-Disposition": contentDisposition(inline ? "inline" : "attachment", item.name),
		"Accept-Ranges": "bytes",
		ETag: obj.httpEtag,
		"X-Content-Type-Options": "nosniff",
		// The browser's PDF viewer doesn't run under a sandbox CSP; PDFs are shown by
		// that viewer, never as a page on this origin.
		"Content-Security-Policy":
			mime === "application/pdf" ? "default-src 'none'; object-src 'self'" : "sandbox; default-src 'none'; img-src 'self' data:; media-src 'self'; style-src 'unsafe-inline'",
		"Cache-Control": "private, max-age=0, must-revalidate",
	});
	if (!("body" in obj)) return new Response(null, { status: 304, headers });
	const range = obj.range as { offset?: number; length?: number; suffix?: number } | undefined;
	if (range && request.headers.has("range")) {
		const offset = range.offset ?? (range.suffix !== undefined ? obj.size - range.suffix : 0);
		const length = range.length ?? obj.size - offset;
		headers.set("Content-Range", `bytes ${offset}-${offset + length - 1}/${obj.size}`);
		headers.set("Content-Length", String(length));
		return new Response(obj.body, { status: 206, headers });
	}
	headers.set("Content-Length", String(obj.size));
	return new Response(obj.body, { status: 200, headers });
}
