/**
 * RPC entrypoint for other Workers on this account (the agentic-inbox Worker
 * binds it as a service binding). Service bindings never leave Cloudflare and
 * can't be called from the internet, so there is no Access check here.
 */
import { WorkerEntrypoint } from "cloudflare:workers";
import { FREE_STORAGE_BYTES } from "../shared/limits";
import type { Item } from "./drive-do";
import { abortUpload, beginUpload, completeUpload, putFile, uploadPart, type BeginUpload } from "./files";
import { shareExpiry, shareUrl } from "./api";
import { driveStub, type Env } from "./types";

export type DriveItem = Pick<Item, "id" | "parent_id" | "kind" | "name" | "size" | "mime" | "created_at" | "updated_at">;

function slim(i: Item): DriveItem {
	return { id: i.id, parent_id: i.parent_id, kind: i.kind, name: i.name, size: i.size, mime: i.mime, created_at: i.created_at, updated_at: i.updated_at };
}

export class DriveService extends WorkerEntrypoint<Env> {
	/** Web address of the Drive app, for "Open in Drive" links. */
	async info() {
		const stats = await driveStub(this.env).stats();
		return { url: this.env.PUBLIC_URL, ...stats, limit: FREE_STORAGE_BYTES };
	}

	async list(parentId: string | null) {
		const r = await driveStub(this.env).list(parentId);
		return { breadcrumbs: r.breadcrumbs, items: r.items.map(slim) };
	}

	async search(query: string) {
		return (await driveStub(this.env).search(query)).map(slim);
	}

	async getItem(id: string) {
		const i = await driveStub(this.env).getItem(id);
		return i && !i.trashed_at ? slim(i) : null;
	}

	/** Save a stream (e.g. an email attachment) into a folder path such as ["From email"]. */
	async saveFile(f: { name: string; size: number; mime?: string; body: ReadableStream<Uint8Array>; folder?: string[]; source?: string }) {
		const parentId = f.folder?.length ? await driveStub(this.env).ensureFolderPath(f.folder) : null;
		return slim(await putFile(this.env, { parentId, name: f.name, size: f.size, mime: f.mime, body: f.body, source: f.source }));
	}

	/** Start a multipart upload into a folder path; parts then go through uploadPart. */
	async beginUpload(b: Omit<BeginUpload, "parentId"> & { folder?: string[] }) {
		const parentId = b.folder?.length ? await driveStub(this.env).ensureFolderPath(b.folder) : null;
		const r = await beginUpload(this.env, { ...b, parentId });
		return "file" in r ? { file: slim(r.file) } : r;
	}

	async uploadPart(uploadId: string, partNumber: number, body: ReadableStream<Uint8Array>, length: number) {
		return uploadPart(this.env, uploadId, partNumber, body, length);
	}

	async completeUpload(uploadId: string, parts: Array<{ partNumber: number; etag: string }>, source?: string) {
		return slim(await completeUpload(this.env, uploadId, parts, source));
	}

	async abortUpload(uploadId: string) {
		await abortUpload(this.env, uploadId);
	}

	/** A public download link for a file. `days` null means it never expires. */
	async createShareLink(itemId: string, days?: number | null) {
		const s = await driveStub(this.env).createShare(itemId, shareExpiry(days));
		return { url: shareUrl(this.env, s.token), token: s.token, expiresAt: s.expires_at };
	}
}
