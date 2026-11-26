import ArticleIcon from "@mui/icons-material/Article";
import AudioFileIcon from "@mui/icons-material/AudioFile";
import CodeIcon from "@mui/icons-material/Code";
import DescriptionIcon from "@mui/icons-material/Description";
import FolderIcon from "@mui/icons-material/Folder";
import FolderZipIcon from "@mui/icons-material/FolderZip";
import ImageIcon from "@mui/icons-material/Image";
import InsertDriveFileIcon from "@mui/icons-material/InsertDriveFile";
import MovieIcon from "@mui/icons-material/Movie";
import PictureAsPdfIcon from "@mui/icons-material/PictureAsPdf";
import SlideshowIcon from "@mui/icons-material/Slideshow";
import TableChartIcon from "@mui/icons-material/TableChart";
import type { SvgIconComponent } from "@mui/icons-material";
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

export function formatDateTime(ms: number): string {
	return new Date(ms).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

export type FileKind = "folder" | "image" | "video" | "audio" | "pdf" | "archive" | "sheet" | "slides" | "doc" | "code" | "text" | "file";

const EXT: Record<string, FileKind> = {
	zip: "archive", tar: "archive", gz: "archive", "7z": "archive", rar: "archive",
	xlsx: "sheet", xls: "sheet", csv: "sheet", ods: "sheet",
	pptx: "slides", ppt: "slides", key: "slides", odp: "slides",
	doc: "doc", docx: "doc", odt: "doc", rtf: "doc", pages: "doc",
	js: "code", ts: "code", tsx: "code", jsx: "code", py: "code", rs: "code", go: "code", json: "code", html: "code", css: "code", sh: "code", yml: "code", yaml: "code",
	md: "text", txt: "text", log: "text",
};

export function fileKind(item: Pick<Item, "kind" | "mime" | "name">): FileKind {
	if (item.kind === "folder") return "folder";
	const m = item.mime ?? "";
	if (m.startsWith("image/")) return "image";
	if (m.startsWith("video/")) return "video";
	if (m.startsWith("audio/")) return "audio";
	if (m === "application/pdf") return "pdf";
	const ext = item.name.split(".").pop()?.toLowerCase() ?? "";
	if (EXT[ext]) return EXT[ext];
	if (/zip|compressed|tar/.test(m)) return "archive";
	if (/sheet|excel|csv/.test(m)) return "sheet";
	if (/presentation|powerpoint/.test(m)) return "slides";
	if (/word|document/.test(m)) return "doc";
	if (m.startsWith("text/")) return "text";
	return "file";
}

/** Icon and colour per kind, after Google Drive's file-type colours. */
export const KIND_STYLE: Record<FileKind, { icon: SvgIconComponent; color: string; label: string }> = {
	folder: { icon: FolderIcon, color: "#5f6368", label: "Folder" },
	image: { icon: ImageIcon, color: "#d93025", label: "Image" },
	video: { icon: MovieIcon, color: "#d93025", label: "Video" },
	audio: { icon: AudioFileIcon, color: "#d93025", label: "Audio" },
	pdf: { icon: PictureAsPdfIcon, color: "#ea4335", label: "PDF" },
	archive: { icon: FolderZipIcon, color: "#5f6368", label: "Archive" },
	sheet: { icon: TableChartIcon, color: "#188038", label: "Spreadsheet" },
	slides: { icon: SlideshowIcon, color: "#f9ab00", label: "Presentation" },
	doc: { icon: ArticleIcon, color: "#1a73e8", label: "Document" },
	code: { icon: CodeIcon, color: "#5f6368", label: "Code" },
	text: { icon: DescriptionIcon, color: "#1a73e8", label: "Text" },
	file: { icon: InsertDriveFileIcon, color: "#5f6368", label: "File" },
};

export type PreviewKind = "image" | "video" | "audio" | "pdf" | "text" | null;

export function previewKind(item: Pick<Item, "kind" | "mime" | "size" | "name">): PreviewKind {
	if (item.kind !== "file") return null;
	const m = item.mime ?? "";
	if (m.startsWith("image/") && m !== "image/svg+xml") return "image";
	if (m.startsWith("video/")) return "video";
	if (m.startsWith("audio/")) return "audio";
	if (m === "application/pdf") return "pdf";
	const k = fileKind(item);
	if ((k === "text" || k === "code" || m === "application/json") && m !== "text/html") return item.size <= 2 * 1024 * 1024 ? "text" : null;
	return null;
}

export function mimeFor(file: File): string {
	if (file.type) return file.type;
	const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
	const map: Record<string, string> = {
		md: "text/markdown", txt: "text/plain", log: "text/plain", csv: "text/csv", json: "application/json",
		mkv: "video/x-matroska", mp4: "video/mp4", mov: "video/quicktime", heic: "image/heic", webp: "image/webp",
	};
	return map[ext] ?? "application/octet-stream";
}
