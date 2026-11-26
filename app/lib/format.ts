import {
	FileArchiveIcon,
	FileAudioIcon,
	FileCodeIcon,
	FileDocIcon,
	FileIcon,
	FileImageIcon,
	FilePdfIcon,
	FileTextIcon,
	FileVideoIcon,
	FileXlsIcon,
	FolderSimpleIcon,
	type Icon,
} from "@phosphor-icons/react";
import type { Item } from "./api";

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

export function formatDate(ms: number): string {
	const d = new Date(ms);
	const now = new Date();
	if (d.toDateString() === now.toDateString()) return d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
	return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: d.getFullYear() === now.getFullYear() ? undefined : "numeric" });
}

export function iconFor(item: Pick<Item, "kind" | "mime" | "name">): Icon {
	if (item.kind === "folder") return FolderSimpleIcon;
	const m = item.mime ?? "";
	const ext = item.name.split(".").pop()?.toLowerCase() ?? "";
	if (m.startsWith("image/")) return FileImageIcon;
	if (m.startsWith("video/")) return FileVideoIcon;
	if (m.startsWith("audio/")) return FileAudioIcon;
	if (m === "application/pdf") return FilePdfIcon;
	if (/zip|tar|gzip|7z|rar/.test(m) || ["zip", "tar", "gz", "7z", "rar"].includes(ext)) return FileArchiveIcon;
	if (/sheet|excel|csv/.test(m) || ["xlsx", "xls", "csv"].includes(ext)) return FileXlsIcon;
	if (/word|document|rtf/.test(m) || ["doc", "docx", "odt", "rtf"].includes(ext)) return FileDocIcon;
	if (/json|javascript|typescript|xml|html|css/.test(m) || ["js", "ts", "tsx", "py", "rs", "go", "json", "html", "css"].includes(ext)) return FileCodeIcon;
	if (m.startsWith("text/")) return FileTextIcon;
	return FileIcon;
}

export type PreviewKind = "image" | "video" | "audio" | "pdf" | "text" | null;

export function previewKind(item: Pick<Item, "kind" | "mime" | "size">): PreviewKind {
	if (item.kind !== "file") return null;
	const m = item.mime ?? "";
	if (m.startsWith("image/") && m !== "image/svg+xml") return "image";
	if (m.startsWith("video/")) return "video";
	if (m.startsWith("audio/")) return "audio";
	if (m === "application/pdf") return "pdf";
	if ((m.startsWith("text/") && m !== "text/html") || m === "application/json") return item.size <= 2 * 1024 * 1024 ? "text" : null;
	return null;
}

/** Guess a type for files the browser reports without one. */
export function mimeFor(file: File): string {
	if (file.type) return file.type;
	const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
	const map: Record<string, string> = {
		md: "text/markdown", txt: "text/plain", log: "text/plain", csv: "text/csv", json: "application/json",
		mkv: "video/x-matroska", mp4: "video/mp4", mov: "video/quicktime", heic: "image/heic", webp: "image/webp",
	};
	return map[ext] ?? "application/octet-stream";
}
