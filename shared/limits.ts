/**
 * Limits shared by the Worker and the browser.
 *
 * A single request body is capped at 100 MB by the zone's Cloudflare plan, so
 * files are uploaded in parts through an R2 multipart upload. R2 needs every
 * part except the last to be the same size and at least 5 MiB.
 */
export const PART_SIZE = 50 * 1024 * 1024;
export const MAX_FILE_BYTES = 5 * 1024 * 1024 * 1024;
export const MAX_PARTS = Math.ceil(MAX_FILE_BYTES / PART_SIZE);
/** R2's free allocation; the storage meter measures against it. */
export const FREE_STORAGE_BYTES = 10 * 1024 * 1024 * 1024;
/** Trashed items are deleted for good after this long. */
export const TRASH_RETENTION_MS = 30 * 86_400_000;
export const MAX_NAME_LENGTH = 255;
export const DEFAULT_SHARE_DAYS = 30;
export const MAX_SHARE_DAYS = 365;

export function partCount(size: number): number {
	return Math.max(1, Math.ceil(size / PART_SIZE));
}

/** Expected byte length of part `n` (1-based) of a file of `size` bytes. */
export function partLength(size: number, n: number): number {
	const count = partCount(size);
	if (n < 1 || n > count) return -1;
	return n < count ? PART_SIZE : size - PART_SIZE * (count - 1);
}
