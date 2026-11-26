/**
 * Public share links: /s/<token> (a small download page) and
 * /s/<token>/download (the bytes). These paths sit behind an Access Bypass
 * app; the unguessable token is the only credential.
 */
import { Hono } from "hono";
import { serveFile } from "./files";
import { driveStub, type Env } from "./types";

export const share = new Hono<{ Bindings: Env }>().basePath("/s");

const TOKEN = /^[A-Za-z0-9_-]{20,64}$/;

function escapeHtml(s: string): string {
	return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

export function formatBytes(n: number): string {
	if (n < 1024) return `${n} B`;
	const units = ["KB", "MB", "GB", "TB"];
	let v = n / 1024;
	let i = 0;
	while (v >= 1024 && i < units.length - 1) {
		v /= 1024;
		i++;
	}
	return `${v.toFixed(v < 10 ? 1 : 0)} ${units[i]}`;
}

const PAGE_HEADERS = {
	"Content-Type": "text/html; charset=utf-8",
	"Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; img-src 'self'; media-src 'self'",
	"X-Content-Type-Options": "nosniff",
	"Referrer-Policy": "no-referrer",
	"X-Robots-Tag": "noindex, nofollow",
	"Cache-Control": "no-store",
};

function page(title: string, inner: string, status = 200): Response {
	const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light dark"><title>${escapeHtml(title)}</title>
<style>
:root{--bg:#f6f6f4;--card:#fff;--fg:#1d1d1b;--muted:#6b6b66;--line:#e2e2de;--brand:#f6821f}
@media (prefers-color-scheme:dark){:root{--bg:#141413;--card:#1e1e1c;--fg:#ededea;--muted:#a3a39e;--line:#33332f}}
*{box-sizing:border-box}body{margin:0;min-height:100vh;display:grid;place-items:center;background:var(--bg);color:var(--fg);font:15px/1.5 system-ui,-apple-system,"Segoe UI",sans-serif;padding:16px}
main{width:100%;max-width:520px;background:var(--card);border:1px solid var(--line);border-radius:12px;padding:28px}
h1{font-size:18px;margin:0 0 4px;word-break:break-word}p{margin:0;color:var(--muted)}
.btn{display:inline-block;margin-top:20px;background:var(--brand);color:#fff;text-decoration:none;font-weight:600;padding:10px 18px;border-radius:8px}
.preview{margin-top:20px;max-width:100%;border-radius:8px;border:1px solid var(--line)}
footer{margin-top:20px;font-size:12px;color:var(--muted)}
</style></head><body><main>${inner}</main></body></html>`;
	return new Response(html, { status, headers: PAGE_HEADERS });
}

const gone = () => page("Link unavailable", "<h1>This link isn't available</h1><p>It may have expired or been turned off by the person who shared it.</p>", 404);

share.get("/:token", async (c) => {
	const token = c.req.param("token");
	if (!TOKEN.test(token)) return gone();
	const found = await driveStub(c.env).resolveShare(token);
	if (!found) return gone();
	const { item, share: s } = found;
	const name = escapeHtml(item.name);
	const href = `/s/${token}/download`;
	const mime = item.mime ?? "";
	const preview = mime.startsWith("image/") && mime !== "image/svg+xml"
		? `<img class="preview" src="${href}?inline=1" alt="">`
		: mime.startsWith("video/")
			? `<video class="preview" src="${href}?inline=1" controls preload="metadata"></video>`
			: mime.startsWith("audio/")
				? `<audio class="preview" src="${href}?inline=1" controls preload="metadata"></audio>`
				: "";
	const expires = s.expires_at ? `Link expires ${new Date(s.expires_at).toUTCString().replace(/ \d\d:\d\d:\d\d GMT$/, "")}.` : "";
	return page(item.name, `<h1>${name}</h1><p>${formatBytes(item.size)}</p>${preview}<a class="btn" href="${href}">Download</a><footer>${expires}</footer>`);
});

share.get("/:token/download", async (c) => {
	const token = c.req.param("token");
	if (!TOKEN.test(token)) return gone();
	const inline = c.req.query("inline") === "1";
	// Count real downloads only, not previews or the extra Range requests a player makes.
	const count = !inline && !c.req.header("range");
	const found = await driveStub(c.env).resolveShare(token, count);
	if (!found) return gone();
	const res = await serveFile(c.env, found.item, c.req.raw, { download: !inline });
	res.headers.set("Referrer-Policy", "no-referrer");
	res.headers.set("X-Robots-Tag", "noindex, nofollow");
	return res;
});
