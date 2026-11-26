/** Browser client for the Drive API. */

export type Item = {
	id: string;
	parent_id: string | null;
	kind: "file" | "folder";
	name: string;
	size: number;
	mime: string | null;
	created_at: number;
	updated_at: number;
	trashed_at: number | null;
	parent_name?: string | null;
};

export type Listing = { folder: Item | null; breadcrumbs: Array<{ id: string; name: string }>; items: Item[] };
export type Share = { token: string; item_id: string; created_at: number; expires_at: number | null; downloads: number; url: string };
export type Stats = { bytes: number; files: number; trashBytes: number; limit: number };

export class ApiError extends Error {
	constructor(
		message: string,
		readonly status: number,
	) {
		super(message);
	}
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
	const res = await fetch(path, {
		method,
		headers: body === undefined ? undefined : { "Content-Type": "application/json" },
		body: body === undefined ? undefined : JSON.stringify(body),
	});
	if (res.status === 204) return undefined as T;
	const data = (await res.json().catch(() => ({}))) as { error?: string };
	if (!res.ok) throw new ApiError(data.error || `Request failed (${res.status})`, res.status);
	return data as T;
}

export const contentUrl = (id: string, download = false) => `/api/files/${id}/content${download ? "?download=1" : ""}`;

export const api = {
	list: (parentId: string | null) => request<Listing>("GET", `/api/files${parentId ? `?parent=${parentId}` : ""}`),
	search: (q: string) => request<{ items: Item[] }>("GET", `/api/search?q=${encodeURIComponent(q)}`),
	trash: () => request<{ items: Item[] }>("GET", "/api/trash"),
	stats: () => request<Stats>("GET", "/api/stats"),
	createFolder: (parentId: string | null, name: string) => request<Item>("POST", "/api/folders", { parentId, name }),
	rename: (id: string, name: string) => request<Item>("PATCH", `/api/files/${id}`, { name }),
	move: (id: string, parentId: string | null) => request<Item>("PATCH", `/api/files/${id}`, { parentId }),
	trashItem: (id: string) => request<Item>("DELETE", `/api/files/${id}`),
	restore: (id: string) => request<Item>("POST", `/api/files/${id}/restore`),
	purge: (id: string) => request<{ deleted: number }>("DELETE", `/api/files/${id}?permanent=1`),
	emptyTrash: () => request<{ deleted: number }>("DELETE", "/api/trash"),
	shares: (id: string) => request<{ shares: Share[] }>("GET", `/api/files/${id}/shares`),
	share: (id: string, expiresInDays: number | null) => request<Share>("POST", `/api/files/${id}/shares`, { expiresInDays }),
	revokeShare: (token: string) => request<void>("DELETE", `/api/shares/${token}`),
	beginUpload: (b: { parentId: string | null; name: string; size: number; mime: string }) =>
		request<{ uploadId: string; partSize: number; partCount: number } | { file: Item }>("POST", "/api/uploads", b),
	completeUpload: (id: string, parts: Array<{ partNumber: number; etag: string }>) =>
		request<Item>("POST", `/api/uploads/${id}/complete`, { parts }),
	abortUpload: (id: string) => request<void>("DELETE", `/api/uploads/${id}`),
};
