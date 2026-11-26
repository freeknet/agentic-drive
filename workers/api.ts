import { Hono } from "hono";
import { z } from "zod";
import { DEFAULT_SHARE_DAYS, FREE_STORAGE_BYTES, MAX_SHARE_DAYS } from "../shared/limits";
import { errorStatus } from "./drive-do";
import { abortUpload, beginUpload, completeUpload, serveFile, uploadPart } from "./files";
import { sameOriginOnly } from "./same-origin";
import { driveStub, type Env } from "./types";

export const api = new Hono<{ Bindings: Env }>().basePath("/api");

api.onError((e, c) => {
	if (e instanceof z.ZodError) return c.json({ error: e.issues[0]?.message ?? "Invalid request" }, 400);
	const { status, message } = errorStatus(e);
	if (status === 500) console.error("API error:", e);
	return c.json({ error: message }, status);
});

// CSRF: Access authenticates by cookie, so another site's form or fetch would
// carry it. Writes must come from this origin.
api.use("*", sameOriginOnly);

const id = z.uuid();
const parentId = id.nullable();

async function body<T>(c: { req: { json: () => Promise<unknown> } }, schema: z.ZodType<T>): Promise<T> {
	const parsed = schema.safeParse(await c.req.json().catch(() => undefined));
	if (!parsed.success) throw new Error(`[400] ${parsed.error.issues[0]?.message ?? "Invalid request"}`);
	return parsed.data;
}

export function shareUrl(env: Env, token: string): string {
	return `${(env.PUBLIC_URL || "").replace(/\/$/, "")}/s/${token}`;
}

export function shareExpiry(days: number | null | undefined): number | null {
	if (days === null) return null;
	const d = days ?? DEFAULT_SHARE_DAYS;
	return Date.now() + Math.min(Math.max(d, 1), MAX_SHARE_DAYS) * 86_400_000;
}

/** Settings the browser needs: where the Mail app lives, for the app switcher. */
api.get("/config", (c) => c.json({ mailUrl: c.env.MAIL_URL || null }));

// ── browsing ───────────────────────────────────────────────────────

api.get("/files", async (c) => {
	const parent = c.req.query("parent");
	return c.json(await driveStub(c.env).list(parent && parent !== "root" ? id.parse(parent) : null));
});

api.get("/files/:id", async (c) => {
	const item = await driveStub(c.env).getItem(id.parse(c.req.param("id")));
	return item ? c.json(item) : c.json({ error: "Not found" }, 404);
});

api.get("/files/:id/content", async (c) => {
	const item = await driveStub(c.env).getItem(id.parse(c.req.param("id")));
	if (!item || item.kind !== "file" || item.trashed_at) return c.json({ error: "Not found" }, 404);
	return serveFile(c.env, item, c.req.raw, { download: c.req.query("download") === "1" });
});

api.get("/search", async (c) => c.json({ items: await driveStub(c.env).search(c.req.query("q") ?? "") }));

api.get("/stats", async (c) => c.json({ ...(await driveStub(c.env).stats()), limit: FREE_STORAGE_BYTES }));

// ── changing ───────────────────────────────────────────────────────

api.post("/folders", async (c) => {
	const b = await body(c, z.object({ parentId, name: z.string() }));
	return c.json(await driveStub(c.env).createFolder(b.parentId, b.name), 201);
});

api.patch("/files/:id", async (c) => {
	const b = await body(c, z.object({ name: z.string().optional(), parentId: parentId.optional(), starred: z.boolean().optional() }));
	const drive = driveStub(c.env);
	const itemId = id.parse(c.req.param("id"));
	const { starred, ...rest } = b;
	let item = starred === undefined ? null : await drive.setStarred(itemId, starred);
	if (rest.name !== undefined || rest.parentId !== undefined) item = await drive.update(itemId, rest);
	return item ? c.json(item) : c.json(await drive.getItem(itemId));
});

api.get("/recent", async (c) => c.json({ items: await driveStub(c.env).listRecent(Number(c.req.query("limit") ?? 50) || 50) }));

api.get("/starred", async (c) => c.json({ items: await driveStub(c.env).listStarred() }));

/** Move to the trash, or with ?permanent=1 delete a trashed item for good. */
api.delete("/files/:id", async (c) => {
	const drive = driveStub(c.env);
	const itemId = id.parse(c.req.param("id"));
	if (c.req.query("permanent") === "1") return c.json({ deleted: await drive.purge(itemId) });
	return c.json(await drive.trash(itemId));
});

api.post("/files/:id/restore", async (c) => c.json(await driveStub(c.env).restore(id.parse(c.req.param("id")))));

api.get("/trash", async (c) => c.json({ items: await driveStub(c.env).listTrash() }));

api.delete("/trash", async (c) => c.json({ deleted: await driveStub(c.env).emptyTrash() }));

// ── uploads (R2 multipart; each part is its own request, under the 100 MB cap) ──

api.post("/uploads", async (c) => {
	const b = await body(c, z.object({ parentId, name: z.string(), size: z.number().int().nonnegative(), mime: z.string().optional() }));
	return c.json(await beginUpload(c.env, b), 201);
});

api.put("/uploads/:id/parts/:n", async (c) => {
	const length = Number(c.req.header("content-length"));
	if (!Number.isFinite(length)) return c.json({ error: "Content-Length is required" }, 411);
	return c.json(await uploadPart(c.env, id.parse(c.req.param("id")), Number(c.req.param("n")), c.req.raw.body, length));
});

api.post("/uploads/:id/complete", async (c) => {
	const b = await body(c, z.object({ parts: z.array(z.object({ partNumber: z.number().int().positive(), etag: z.string() })).min(1) }));
	return c.json(await completeUpload(c.env, id.parse(c.req.param("id")), b.parts), 201);
});

api.delete("/uploads/:id", async (c) => {
	await abortUpload(c.env, id.parse(c.req.param("id")));
	return c.body(null, 204);
});

// ── share links ────────────────────────────────────────────────────

api.get("/files/:id/shares", async (c) => {
	const shares = await driveStub(c.env).listShares(id.parse(c.req.param("id")));
	return c.json({ shares: shares.map((s) => ({ ...s, url: shareUrl(c.env, s.token) })) });
});

api.post("/files/:id/shares", async (c) => {
	const b = await body(c, z.object({ expiresInDays: z.number().int().min(1).max(MAX_SHARE_DAYS).nullable().optional() }));
	const share = await driveStub(c.env).createShare(id.parse(c.req.param("id")), shareExpiry(b.expiresInDays));
	return c.json({ ...share, url: shareUrl(c.env, share.token) }, 201);
});

api.delete("/shares/:token", async (c) => {
	const ok = await driveStub(c.env).revokeShare(c.req.param("token"));
	return ok ? c.body(null, 204) : c.json({ error: "Not found" }, 404);
});
