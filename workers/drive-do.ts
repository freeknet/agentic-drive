import { DurableObject } from "cloudflare:workers";
import { MAX_NAME_LENGTH, TRASH_RETENTION_MS } from "../shared/limits";
import type { Env } from "./types";

export type ItemKind = "file" | "folder";

export type Item = {
	id: string;
	parent_id: string | null;
	kind: ItemKind;
	name: string;
	size: number;
	mime: string | null;
	r2_key: string | null;
	created_at: number;
	updated_at: number;
	trashed_at: number | null;
	trash_root: string | null;
	source: string | null;
};

export type Upload = {
	id: string;
	parent_id: string | null;
	name: string;
	size: number;
	mime: string;
	r2_key: string;
	mpu_id: string;
	created_at: number;
};

export type Share = {
	token: string;
	item_id: string;
	created_at: number;
	expires_at: number | null;
	downloads: number;
};

/**
 * A user-facing error. Errors cross Durable Object RPC as plain Errors (the
 * class and extra fields are lost), so the HTTP status rides in the message
 * as "[404] Not found"; `errorStatus` reads it back.
 */
export class DriveError extends Error {
	constructor(message: string, status: 400 | 404 | 409 | 413 = 400) {
		super(`[${status}] ${message}`);
	}
}

export function errorStatus(e: unknown): { status: 400 | 404 | 409 | 413 | 500; message: string } {
	const m = /^\[(400|404|409|413)\] ([\s\S]*)$/.exec(e instanceof Error ? e.message : String(e));
	if (m) return { status: Number(m[1]) as 400 | 404 | 409 | 413, message: m[2] };
	return { status: 500, message: "Something went wrong" };
}

const MIGRATIONS = [
	`CREATE TABLE IF NOT EXISTS items (
		id TEXT PRIMARY KEY,
		parent_id TEXT,
		kind TEXT NOT NULL CHECK (kind IN ('file', 'folder')),
		name TEXT NOT NULL,
		size INTEGER NOT NULL DEFAULT 0,
		mime TEXT,
		r2_key TEXT,
		created_at INTEGER NOT NULL,
		updated_at INTEGER NOT NULL,
		trashed_at INTEGER,
		trash_root TEXT,
		source TEXT
	);
	CREATE INDEX IF NOT EXISTS items_parent ON items (parent_id, trashed_at);
	CREATE INDEX IF NOT EXISTS items_trash_root ON items (trash_root);
	CREATE TABLE IF NOT EXISTS uploads (
		id TEXT PRIMARY KEY,
		parent_id TEXT,
		name TEXT NOT NULL,
		size INTEGER NOT NULL,
		mime TEXT NOT NULL,
		r2_key TEXT NOT NULL,
		mpu_id TEXT NOT NULL,
		created_at INTEGER NOT NULL
	);
	CREATE TABLE IF NOT EXISTS shares (
		token TEXT PRIMARY KEY,
		item_id TEXT NOT NULL,
		created_at INTEGER NOT NULL,
		expires_at INTEGER,
		downloads INTEGER NOT NULL DEFAULT 0
	);
	CREATE INDEX IF NOT EXISTS shares_item ON shares (item_id);`,
];

const DAY_MS = 86_400_000;
/** Unfinished uploads older than this are forgotten (R2 aborts them after 7 days). */
const STALE_UPLOAD_MS = 7 * DAY_MS;

/** Trim, drop control characters and path separators, and cap the length. */
export function cleanName(raw: string): string {
	const name = raw
		.replace(/[\u0000-\u001f\u007f/\\]/g, " ")
		.replace(/\s+/g, " ")
		.trim()
		.slice(0, MAX_NAME_LENGTH);
	if (!name || name === "." || name === "..") throw new DriveError("Enter a name");
	return name;
}

function randomToken(): string {
	const bytes = crypto.getRandomValues(new Uint8Array(24));
	let s = "";
	for (const b of bytes) s += String.fromCharCode(b);
	return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/**
 * One Durable Object holds the whole drive's metadata in SQLite. File bytes
 * live in R2 under `files/<uuid>`; this object never reads them, it only
 * deletes them when items are purged.
 */
export class DriveDO extends DurableObject<Env> {
	private sql: SqlStorage;

	constructor(ctx: DurableObjectState, env: Env) {
		super(ctx, env);
		this.sql = ctx.storage.sql;
		ctx.blockConcurrencyWhile(async () => {
			this.sql.exec("CREATE TABLE IF NOT EXISTS _migrations (version INTEGER PRIMARY KEY)");
			const done = new Set([...this.sql.exec<{ version: number }>("SELECT version FROM _migrations")].map((r) => r.version));
			MIGRATIONS.forEach((m, i) => {
				if (done.has(i)) return;
				this.sql.exec(m);
				this.sql.exec("INSERT INTO _migrations (version) VALUES (?)", i);
			});
			if ((await ctx.storage.getAlarm()) === null) await ctx.storage.setAlarm(Date.now() + DAY_MS);
		});
	}

	// ── reading ─────────────────────────────────────────────────────

	private row(id: string): Item | null {
		return ([...this.sql.exec<Item>("SELECT * FROM items WHERE id = ?", id)][0] as Item | undefined) ?? null;
	}

	getItem(id: string): Item | null {
		return this.row(id);
	}

	/** A live (not trashed) folder, or null for the root. Throws if missing. */
	private folder(id: string | null): Item | null {
		if (!id) return null;
		const f = this.row(id);
		if (!f || f.kind !== "folder" || f.trashed_at) throw new DriveError("Folder not found", 404);
		return f;
	}

	private breadcrumbs(folder: Item | null): Array<{ id: string; name: string }> {
		const out: Array<{ id: string; name: string }> = [];
		let cur = folder;
		for (let guard = 0; cur && guard < 100; guard++) {
			out.unshift({ id: cur.id, name: cur.name });
			cur = cur.parent_id ? this.row(cur.parent_id) : null;
		}
		return out;
	}

	list(parentId: string | null) {
		const folder = this.folder(parentId);
		const items = [
			...this.sql.exec<Item>(
				`SELECT * FROM items WHERE parent_id IS ? AND trashed_at IS NULL
				 ORDER BY kind = 'file', name COLLATE NOCASE`,
				parentId,
			),
		] as Item[];
		return { folder, breadcrumbs: this.breadcrumbs(folder), items };
	}

	listTrash(): Item[] {
		return [...this.sql.exec<Item>("SELECT * FROM items WHERE trash_root = id ORDER BY trashed_at DESC")] as Item[];
	}

	search(query: string): Array<Item & { parent_name: string | null }> {
		const q = query.trim();
		if (!q) return [];
		const like = `%${q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
		return [
			...this.sql.exec(
				`SELECT i.*, p.name AS parent_name FROM items i LEFT JOIN items p ON p.id = i.parent_id
				 WHERE i.trashed_at IS NULL AND i.name LIKE ? ESCAPE '\\'
				 ORDER BY i.kind = 'file', i.name COLLATE NOCASE LIMIT 100`,
				like,
			),
		] as unknown as Array<Item & { parent_name: string | null }>;
	}

	stats() {
		const r = [
			...this.sql.exec<{ bytes: number; files: number; trash: number }>(
				`SELECT COALESCE(SUM(size), 0) AS bytes, COUNT(*) AS files,
				 COALESCE(SUM(CASE WHEN trashed_at IS NOT NULL THEN size END), 0) AS trash
				 FROM items WHERE kind = 'file'`,
			),
		][0];
		return { bytes: r.bytes, files: r.files, trashBytes: r.trash };
	}

	// ── changing ────────────────────────────────────────────────────

	createFolder(parentId: string | null, rawName: string): Item {
		this.folder(parentId);
		const now = Date.now();
		const id = crypto.randomUUID();
		this.sql.exec(
			"INSERT INTO items (id, parent_id, kind, name, created_at, updated_at) VALUES (?, ?, 'folder', ?, ?, ?)",
			id,
			parentId,
			cleanName(rawName),
			now,
			now,
		);
		return this.row(id)!;
	}

	/** The folder at `path` under the root (e.g. ["From email"]), created as needed. */
	ensureFolderPath(path: string[]): string | null {
		let parent: string | null = null;
		for (const raw of path) {
			const name = cleanName(raw);
			const existing: { id: string } | undefined = [
				...this.sql.exec<{ id: string }>(
					"SELECT id FROM items WHERE parent_id IS ? AND kind = 'folder' AND trashed_at IS NULL AND name = ? LIMIT 1",
					parent,
					name,
				),
			][0];
			parent = existing ? existing.id : this.createFolder(parent, name).id;
		}
		return parent;
	}

	update(id: string, changes: { name?: string; parentId?: string | null }): Item {
		const item = this.row(id);
		if (!item || item.trashed_at) throw new DriveError("Not found", 404);
		const name = changes.name === undefined ? item.name : cleanName(changes.name);
		let parentId = item.parent_id;
		if (changes.parentId !== undefined) {
			parentId = changes.parentId;
			this.folder(parentId);
			// A folder can't move into itself or one of its own subfolders.
			for (let cur = parentId, guard = 0; cur && guard < 100; guard++) {
				if (cur === id) throw new DriveError("A folder can't be moved into itself", 409);
				cur = this.row(cur)?.parent_id ?? null;
			}
		}
		this.sql.exec("UPDATE items SET name = ?, parent_id = ?, updated_at = ? WHERE id = ?", name, parentId, Date.now(), id);
		return this.row(id)!;
	}

	/** Ids of `id` and everything under it. */
	private subtree(id: string): string[] {
		return [
			...this.sql.exec<{ id: string }>(
				`WITH RECURSIVE t(id) AS (SELECT ? UNION ALL SELECT i.id FROM items i JOIN t ON i.parent_id = t.id)
				 SELECT id FROM t`,
				id,
			),
		].map((r) => r.id);
	}

	trash(id: string): Item {
		const item = this.row(id);
		if (!item || item.trashed_at) throw new DriveError("Not found", 404);
		const now = Date.now();
		for (const sub of this.subtree(id)) {
			this.sql.exec("UPDATE items SET trashed_at = ?, trash_root = ? WHERE id = ? AND trashed_at IS NULL", now, id, sub);
		}
		return this.row(id)!;
	}

	restore(id: string): Item {
		const item = this.row(id);
		if (!item || item.trash_root !== id) throw new DriveError("Not in the trash", 404);
		this.sql.exec("UPDATE items SET trashed_at = NULL, trash_root = NULL WHERE trash_root = ?", id);
		// If the folder it came from is gone or trashed, put it back at the top.
		const parent = item.parent_id ? this.row(item.parent_id) : null;
		if (item.parent_id && (!parent || parent.trashed_at)) {
			this.sql.exec("UPDATE items SET parent_id = NULL WHERE id = ?", id);
		}
		return this.row(id)!;
	}

	/** Delete a trashed item and everything under it, including the R2 objects. */
	async purge(id: string): Promise<number> {
		const item = this.row(id);
		if (!item || item.trash_root !== id) throw new DriveError("Only items in the trash can be deleted for good", 409);
		const ids = this.subtree(id);
		const keys: string[] = [];
		for (const sub of ids) {
			const row = this.row(sub);
			if (row?.r2_key) keys.push(row.r2_key);
			this.sql.exec("DELETE FROM items WHERE id = ?", sub);
			this.sql.exec("DELETE FROM shares WHERE item_id = ?", sub);
		}
		for (let i = 0; i < keys.length; i += 1000) await this.env.BUCKET.delete(keys.slice(i, i + 1000));
		return ids.length;
	}

	async emptyTrash(): Promise<number> {
		let n = 0;
		for (const item of this.listTrash()) n += await this.purge(item.id);
		return n;
	}

	// ── uploads ─────────────────────────────────────────────────────

	recordUpload(u: Omit<Upload, "created_at">): Upload {
		this.folder(u.parent_id);
		const name = cleanName(u.name);
		this.sql.exec(
			"INSERT INTO uploads (id, parent_id, name, size, mime, r2_key, mpu_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
			u.id,
			u.parent_id,
			name,
			u.size,
			u.mime,
			u.r2_key,
			u.mpu_id,
			Date.now(),
		);
		return { ...u, name, created_at: Date.now() };
	}

	getUpload(id: string): Upload | null {
		return ([...this.sql.exec<Upload>("SELECT * FROM uploads WHERE id = ?", id)][0] as Upload | undefined) ?? null;
	}

	removeUpload(id: string): void {
		this.sql.exec("DELETE FROM uploads WHERE id = ?", id);
	}

	/** Turn a finished upload into a file. If its folder was trashed meanwhile, it lands at the top. */
	finishUpload(id: string, source?: string): Item {
		const u = this.getUpload(id);
		if (!u) throw new DriveError("Upload not found", 404);
		let parent = u.parent_id;
		try {
			this.folder(parent);
		} catch {
			parent = null;
		}
		this.insertFile({ id: u.id, parentId: parent, name: u.name, size: u.size, mime: u.mime, key: u.r2_key, source });
		this.removeUpload(id);
		return this.row(u.id)!;
	}

	/** Record a file whose bytes are already in R2. */
	addFile(f: { parentId: string | null; name: string; size: number; mime: string; key: string; source?: string }): Item {
		this.folder(f.parentId);
		const id = crypto.randomUUID();
		this.insertFile({ id, ...f });
		return this.row(id)!;
	}

	private insertFile(f: { id: string; parentId: string | null; name: string; size: number; mime: string; key: string; source?: string }) {
		const now = Date.now();
		this.sql.exec(
			`INSERT INTO items (id, parent_id, kind, name, size, mime, r2_key, created_at, updated_at, source)
			 VALUES (?, ?, 'file', ?, ?, ?, ?, ?, ?, ?)`,
			f.id,
			f.parentId,
			cleanName(f.name),
			f.size,
			f.mime,
			f.key,
			now,
			now,
			f.source ?? null,
		);
	}

	// ── share links ─────────────────────────────────────────────────

	createShare(itemId: string, expiresAt: number | null): Share {
		const item = this.row(itemId);
		if (!item || item.trashed_at) throw new DriveError("Not found", 404);
		if (item.kind !== "file") throw new DriveError("Only files can be shared");
		const share: Share = { token: randomToken(), item_id: itemId, created_at: Date.now(), expires_at: expiresAt, downloads: 0 };
		this.sql.exec(
			"INSERT INTO shares (token, item_id, created_at, expires_at) VALUES (?, ?, ?, ?)",
			share.token,
			itemId,
			share.created_at,
			expiresAt,
		);
		return share;
	}

	listShares(itemId: string): Share[] {
		return [
			...this.sql.exec<Share>(
				"SELECT * FROM shares WHERE item_id = ? AND (expires_at IS NULL OR expires_at > ?) ORDER BY created_at DESC",
				itemId,
				Date.now(),
			),
		] as Share[];
	}

	revokeShare(token: string): boolean {
		return this.sql.exec("DELETE FROM shares WHERE token = ?", token).rowsWritten > 0;
	}

	/** The file behind a live share link, or null. `countDownload` adds one to its counter. */
	resolveShare(token: string, countDownload = false): { share: Share; item: Item } | null {
		const share = [...this.sql.exec<Share>("SELECT * FROM shares WHERE token = ?", token)][0] as Share | undefined;
		if (!share || (share.expires_at !== null && share.expires_at <= Date.now())) return null;
		const item = this.row(share.item_id);
		if (!item || item.trashed_at || item.kind !== "file") return null;
		if (countDownload) this.sql.exec("UPDATE shares SET downloads = downloads + 1 WHERE token = ?", token);
		return { share, item };
	}

	// ── housekeeping ────────────────────────────────────────────────

	async alarm() {
		const cutoff = Date.now() - TRASH_RETENTION_MS;
		for (const item of this.listTrash()) {
			if (item.trashed_at !== null && item.trashed_at < cutoff) await this.purge(item.id);
		}
		this.sql.exec("DELETE FROM shares WHERE expires_at IS NOT NULL AND expires_at <= ?", Date.now());
		this.sql.exec("DELETE FROM uploads WHERE created_at < ?", Date.now() - STALE_UPLOAD_MS);
		await this.ctx.storage.setAlarm(Date.now() + DAY_MS);
	}
}
