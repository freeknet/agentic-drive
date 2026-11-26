import { SELF, env, createExecutionContext } from "cloudflare:test";
import { describe, expect, it } from "vitest";
import { DriveService } from "../workers/service";
import type { Env } from "../workers/types";

const E = env as unknown as Env;
const BASE = "https://drive.example.com";

async function call<T = any>(method: string, path: string, body?: unknown, headers: Record<string, string> = {}) {
	const init: RequestInit = { method, headers: { ...headers } };
	if (body instanceof Uint8Array || typeof body === "string") {
		init.body = body;
		(init.headers as Record<string, string>)["Content-Length"] = String(typeof body === "string" ? new TextEncoder().encode(body).length : body.byteLength);
	} else if (body !== undefined) {
		init.body = JSON.stringify(body);
		(init.headers as Record<string, string>)["Content-Type"] = "application/json";
	}
	const res = await SELF.fetch(BASE + path, init);
	const type = res.headers.get("content-type") ?? "";
	const data = type.includes("json") ? await res.json() : await res.text();
	return { status: res.status, data: data as T, headers: res.headers };
}

/** Upload a small file (one part) through the public API. */
async function upload(name: string, content: string, parentId: string | null = null, mime = "text/plain") {
	const bytes = new TextEncoder().encode(content);
	const begin = await call("POST", "/api/uploads", { parentId, name, size: bytes.byteLength, mime });
	expect(begin.status).toBe(201);
	if (begin.data.file) return begin.data.file;
	const part = await call("PUT", `/api/uploads/${begin.data.uploadId}/parts/1`, bytes);
	expect(part.status).toBe(200);
	const done = await call("POST", `/api/uploads/${begin.data.uploadId}/complete`, { parts: [part.data] });
	expect(done.status).toBe(201);
	return done.data;
}

describe("folders", () => {
	it("creates, lists, renames and moves", async () => {
		const docs = (await call("POST", "/api/folders", { parentId: null, name: "Docs" })).data;
		const work = (await call("POST", "/api/folders", { parentId: docs.id, name: "  Work  " })).data;
		expect(work.name).toBe("Work");
		await upload("b.txt", "bee");
		const root = (await call("GET", "/api/files")).data;
		expect(root.items.map((i: any) => i.name)).toEqual(["Docs", "b.txt"]);
		const inside = (await call("GET", `/api/files?parent=${docs.id}`)).data;
		expect(inside.breadcrumbs).toEqual([{ id: docs.id, name: "Docs" }]);
		expect((await call("PATCH", `/api/files/${work.id}`, { name: "Jobs", parentId: null })).data).toMatchObject({ name: "Jobs", parent_id: null });
	});

	it("refuses to move a folder into itself or a subfolder", async () => {
		const a = (await call("POST", "/api/folders", { parentId: null, name: "A" })).data;
		const b = (await call("POST", "/api/folders", { parentId: a.id, name: "B" })).data;
		expect((await call("PATCH", `/api/files/${a.id}`, { parentId: b.id })).status).toBe(409);
		expect((await call("PATCH", `/api/files/${a.id}`, { parentId: a.id })).status).toBe(409);
	});

	it("rejects empty names and unknown folders", async () => {
		expect((await call("POST", "/api/folders", { parentId: null, name: "  " })).status).toBe(400);
		expect((await call("POST", "/api/folders", { parentId: crypto.randomUUID(), name: "x" })).status).toBe(404);
		expect((await call("GET", "/api/files?parent=not-a-uuid")).status).toBe(400);
	});
});

describe("uploads and downloads", () => {
	it("stores a file and serves it back, with Range", async () => {
		const f = await upload("hello.txt", "hello world");
		expect(f).toMatchObject({ name: "hello.txt", size: 11, mime: "text/plain" });
		const full = await call("GET", `/api/files/${f.id}/content`);
		expect(full.data).toBe("hello world");
		expect(full.headers.get("content-security-policy")).toContain("sandbox");
		expect(full.headers.get("content-disposition")).toMatch(/^inline/);
		const part = await call("GET", `/api/files/${f.id}/content`, undefined, { Range: "bytes=6-10" });
		expect(part.status).toBe(206);
		expect(part.data).toBe("world");
		expect(part.headers.get("content-range")).toBe("bytes 6-10/11");
	});

	it("never serves HTML inline", async () => {
		const f = await upload("x.html", "<script>alert(1)</script>", null, "text/html");
		const res = await call("GET", `/api/files/${f.id}/content`);
		expect(res.headers.get("content-disposition")).toMatch(/^attachment/);
		expect(res.headers.get("content-type")).toBe("text/plain; charset=utf-8");
	});

	it("keeps non-ASCII file names", async () => {
		const f = await upload("résumé 2026.txt", "x");
		const res = await call("GET", `/api/files/${f.id}/content?download=1`);
		expect(res.headers.get("content-disposition")).toContain("filename*=UTF-8''r%C3%A9sum%C3%A9%202026.txt");
	});

	it("handles empty files without a multipart upload", async () => {
		const f = await upload("empty.txt", "");
		expect(f.size).toBe(0);
		expect((await call("GET", `/api/files/${f.id}/content`)).data).toBe("");
	});

	it("checks part sizes, part numbers and the size limit", async () => {
		const begin = (await call("POST", "/api/uploads", { parentId: null, name: "a.bin", size: 10 })).data;
		expect(begin).toMatchObject({ partCount: 1 });
		expect((await call("PUT", `/api/uploads/${begin.uploadId}/parts/1`, new Uint8Array(9))).status).toBe(400);
		expect((await call("PUT", `/api/uploads/${begin.uploadId}/parts/2`, new Uint8Array(10))).status).toBe(400);
		expect((await call("POST", `/api/uploads/${begin.uploadId}/complete`, { parts: [] })).status).toBe(400);
		expect((await call("POST", "/api/uploads", { parentId: null, name: "big", size: 6 * 1024 ** 3 })).status).toBe(413);
	});

	it("aborts an upload", async () => {
		const begin = (await call("POST", "/api/uploads", { parentId: null, name: "a.bin", size: 10 })).data;
		expect((await call("DELETE", `/api/uploads/${begin.uploadId}`)).status).toBe(204);
		expect((await call("PUT", `/api/uploads/${begin.uploadId}/parts/1`, new Uint8Array(10))).status).toBe(404);
	});
});

describe("trash", () => {
	it("trashes a folder with its contents, restores it, and purges R2 on delete", async () => {
		const dir = (await call("POST", "/api/folders", { parentId: null, name: "Old" })).data;
		const f = await upload("in.txt", "inside", dir.id);
		const key = (await call("GET", `/api/files/${f.id}`)).data.r2_key;
		await call("DELETE", `/api/files/${dir.id}`);
		expect((await call("GET", "/api/files")).data.items).toEqual([]);
		expect((await call("GET", "/api/trash")).data.items.map((i: any) => i.name)).toEqual(["Old"]);
		expect((await call("GET", `/api/files/${f.id}/content`)).status).toBe(404);

		await call("POST", `/api/files/${dir.id}/restore`);
		expect((await call("GET", `/api/files?parent=${dir.id}`)).data.items.map((i: any) => i.name)).toEqual(["in.txt"]);

		await call("DELETE", `/api/files/${dir.id}`);
		expect((await call("DELETE", `/api/files/${dir.id}?permanent=1`)).data).toEqual({ deleted: 2 });
		expect(await E.BUCKET.head(key)).toBeNull();
	});

	it("only deletes for good what is in the trash", async () => {
		const f = await upload("keep.txt", "x");
		expect((await call("DELETE", `/api/files/${f.id}?permanent=1`)).status).toBe(409);
	});

	it("counts storage, including the trash", async () => {
		await upload("a.txt", "12345");
		const b = await upload("b.txt", "123");
		await call("DELETE", `/api/files/${b.id}`);
		expect((await call("GET", "/api/stats")).data).toMatchObject({ bytes: 8, files: 2, trashBytes: 3, limit: 10 * 1024 ** 3 });
	});
});

describe("search", () => {
	it("finds by name and treats % and _ literally", async () => {
		await upload("Budget 2026.xlsx", "x");
		await upload("100%_done.txt", "x");
		expect((await call("GET", "/api/search?q=budget")).data.items.map((i: any) => i.name)).toEqual(["Budget 2026.xlsx"]);
		expect((await call("GET", "/api/search?q=%25_")).data.items.map((i: any) => i.name)).toEqual(["100%_done.txt"]);
	});
});

describe("share links", () => {
	it("serves a public page and download, counts downloads, and can be revoked", async () => {
		const f = await upload("report.pdf", "%PDF-1.4 fake", null, "application/pdf");
		const s = (await call("POST", `/api/files/${f.id}/shares`, { expiresInDays: 7 })).data;
		expect(s.url).toBe(`${BASE}/s/${s.token}`);
		expect(s.expires_at).toBeGreaterThan(Date.now() + 6 * 86_400_000);

		const pageRes = await call("GET", `/s/${s.token}`);
		expect(pageRes.status).toBe(200);
		expect(pageRes.data).toContain("report.pdf");
		expect(pageRes.headers.get("x-robots-tag")).toContain("noindex");

		const dl = await call("GET", `/s/${s.token}/download`);
		expect(dl.data).toBe("%PDF-1.4 fake");
		expect(dl.headers.get("content-disposition")).toMatch(/^attachment/);
		expect((await call("GET", `/api/files/${f.id}/shares`)).data.shares[0].downloads).toBe(1);

		expect((await call("DELETE", `/api/shares/${s.token}`)).status).toBe(204);
		expect((await call("GET", `/s/${s.token}`)).status).toBe(404);
	});

	it("escapes file names on the public page", async () => {
		const f = await upload("<img src=x onerror=alert(1)>.txt", "x");
		const s = (await call("POST", `/api/files/${f.id}/shares`, {})).data;
		const html = (await call("GET", `/s/${s.token}`)).data as string;
		expect(html).not.toContain("<img src=x");
		expect(html).toContain("&lt;img src=x onerror=alert(1)&gt;.txt");
	});

	it("stops working when the file is trashed, and rejects malformed tokens", async () => {
		const f = await upload("a.txt", "x");
		const s = (await call("POST", `/api/files/${f.id}/shares`, { expiresInDays: null })).data;
		expect(s.expires_at).toBeNull();
		await call("DELETE", `/api/files/${f.id}`);
		expect((await call("GET", `/s/${s.token}/download`)).status).toBe(404);
		expect((await call("GET", "/s/short")).status).toBe(404);
	});

	it("doesn't share folders", async () => {
		const d = (await call("POST", "/api/folders", { parentId: null, name: "D" })).data;
		expect((await call("POST", `/api/files/${d.id}/shares`, {})).status).toBe(400);
	});
});

describe("config", () => {
	it("tells the browser where Mail lives, for the app switcher", async () => {
		expect((await call("GET", "/api/config")).data).toEqual({ mailUrl: "https://mail.example.com" });
	});
});

describe("service binding (used by agentic-inbox)", () => {
	const svc = () => new DriveService(createExecutionContext(), E);

	it("saves a stream into a folder path and makes a share link", async () => {
		const bytes = new TextEncoder().encode("attachment bytes");
		const item = await svc().saveFile({ name: "invoice.pdf", size: bytes.byteLength, mime: "application/pdf", body: new Response(bytes).body!, folder: ["From email"], source: "email" });
		expect(item).toMatchObject({ name: "invoice.pdf", size: 16 });
		const again = await svc().saveFile({ name: "two.txt", size: 1, body: new Response("x").body!, folder: ["From email"] });
		expect(again.parent_id).toBe(item.parent_id);
		const root = (await call("GET", "/api/files")).data.items;
		expect(root.map((i: any) => i.name)).toEqual(["From email"]);

		const link = await svc().createShareLink(item.id, 3);
		expect(link.url).toMatch(/^https:\/\/drive\.example\.com\/s\/[A-Za-z0-9_-]+$/);
		expect((await call("GET", new URL(link.url).pathname + "/download")).data).toBe("attachment bytes");
	});

	it("runs a multipart upload end to end", async () => {
		const bytes = new TextEncoder().encode("large file stand-in");
		const begin = await svc().beginUpload({ name: "video.mp4", size: bytes.byteLength, mime: "video/mp4", folder: ["Shared from email"] });
		if (!("uploadId" in begin)) throw new Error("expected a multipart upload");
		const part = await svc().uploadPart(begin.uploadId, 1, new Response(bytes).body!, bytes.byteLength);
		const file = await svc().completeUpload(begin.uploadId, [part], "email");
		expect(file).toMatchObject({ name: "video.mp4", mime: "video/mp4", size: bytes.byteLength });
		expect((await svc().info()).files).toBe(1);
	});
});
