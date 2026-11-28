import ArticleIcon from "@mui/icons-material/ArticleOutlined";
import AudioFileIcon from "@mui/icons-material/AudioFileOutlined";
import FolderIcon from "@mui/icons-material/FolderOutlined";
import FolderZipIcon from "@mui/icons-material/FolderZipOutlined";
import ImageIcon from "@mui/icons-material/ImageOutlined";
import MovieIcon from "@mui/icons-material/MovieOutlined";
import PictureAsPdfIcon from "@mui/icons-material/PictureAsPdfOutlined";
import SlideshowIcon from "@mui/icons-material/SlideshowOutlined";
import TableChartIcon from "@mui/icons-material/TableChartOutlined";
import AutoAwesomeIcon from "@mui/icons-material/AutoAwesomeOutlined";
import Box from "@mui/material/Box";
import ButtonBase from "@mui/material/ButtonBase";
import Chip from "@mui/material/Chip";
import Typography from "@mui/material/Typography";
import { alpha } from "@mui/material/styles";
import { useQuery } from "@tanstack/react-query";
import type { ReactElement } from "react";
import { useDrive } from "~/components/DriveProvider";
import { Thumbnail } from "~/components/Thumbnail";
import { api, type Item } from "~/lib/api";
import { type FileKind, fileKind, formatDate, KIND_STYLE } from "~/lib/format";

export type TypeFilter = "all" | "folders" | "docs" | "sheets" | "slides" | "pdfs" | "images" | "videos" | "audio" | "archives";

const FILTERS: { id: TypeFilter; label: string; kinds: FileKind[]; icon: ReactElement; color: string }[] = [
	{ id: "folders", label: "Folders", kinds: ["folder"], icon: <FolderIcon />, color: "#5f6368" },
	{ id: "docs", label: "Documents", kinds: ["doc", "text", "code"], icon: <ArticleIcon />, color: "#1a73e8" },
	{ id: "sheets", label: "Spreadsheets", kinds: ["sheet"], icon: <TableChartIcon />, color: "#188038" },
	{ id: "slides", label: "Presentations", kinds: ["slides"], icon: <SlideshowIcon />, color: "#f9ab00" },
	{ id: "pdfs", label: "PDFs", kinds: ["pdf"], icon: <PictureAsPdfIcon />, color: "#ea4335" },
	{ id: "images", label: "Photos & images", kinds: ["image"], icon: <ImageIcon />, color: "#d93025" },
	{ id: "videos", label: "Videos", kinds: ["video"], icon: <MovieIcon />, color: "#a142f4" },
	{ id: "audio", label: "Audio", kinds: ["audio"], icon: <AudioFileIcon />, color: "#f538a0" },
	{ id: "archives", label: "Archives", kinds: ["archive"], icon: <FolderZipIcon />, color: "#5f6368" },
];

export function matchesType(item: Item, filter: TypeFilter): boolean {
	if (filter === "all") return true;
	return FILTERS.find((f) => f.id === filter)?.kinds.includes(fileKind(item)) ?? true;
}

/**
 * Google Drive's type chips: one per kind of thing in this view (only those
 * present), each in its file type's colour. Click again to clear.
 */
export function TypeFilterChips({ items, value, onChange }: { items: Item[]; value: TypeFilter; onChange: (v: TypeFilter) => void }) {
	const present = FILTERS.filter((f) => items.some((i) => f.kinds.includes(fileKind(i))));
	if (present.length < 2 && value === "all") return null;
	return (
		<Box role="toolbar" aria-label="Filter by type" sx={{ display: "flex", gap: 1, px: { xs: 2, sm: 2.5 }, pb: 1.5, overflowX: "auto", flexShrink: 0, scrollbarWidth: "none", "&::-webkit-scrollbar": { display: "none" } }}>
			{present.map((f) => {
				const on = value === f.id;
				return (
					<Chip
						key={f.id}
						label={f.label}
						icon={f.icon}
						aria-pressed={on}
						onClick={() => onChange(on ? "all" : f.id)}
						onDelete={on ? () => onChange("all") : undefined}
						variant={on ? "filled" : "outlined"}
						sx={{
							flexShrink: 0,
							"& .MuiChip-icon": { color: f.color },
							...(on && { bgcolor: alpha(f.color, 0.18), borderColor: "transparent", fontWeight: 600 }),
						}}
					/>
				);
			})}
		</Box>
	);
}

/** "Suggested": the files you touched most recently, as quick-open cards on My Drive. */
export function SuggestedRow() {
	const d = useDrive();
	const { data } = useQuery({ queryKey: ["recent"], queryFn: api.recent, staleTime: 30_000 });
	const files = (data?.items ?? []).filter((i) => i.kind === "file" && !i.trashed_at).slice(0, 6);
	if (files.length < 2) return null;
	return (
		<Box sx={{ mb: 1 }}>
			<Box sx={{ display: "flex", alignItems: "center", gap: 1, mt: 1, mb: 1.25 }}>
				<AutoAwesomeIcon sx={{ fontSize: 18, color: "#a142f4" }} />
				<Typography variant="subtitle2" sx={{ color: "text.secondary" }}>
					Suggested
				</Typography>
			</Box>
			<Box sx={{ display: "grid", gridAutoFlow: "column", gridAutoColumns: { xs: "60%", sm: "minmax(180px, 220px)" }, gap: 1.5, overflowX: "auto", pb: 1, scrollbarWidth: "thin" }}>
				{files.map((f) => {
					const { icon: Icon, color } = KIND_STYLE[fileKind(f)];
					return (
						<ButtonBase
							key={f.id}
							onClick={() => d.open(f, files)}
							aria-label={`Open ${f.name}`}
							sx={{ display: "block", textAlign: "left", borderRadius: 3, overflow: "hidden", bgcolor: "action.hover", transition: "box-shadow .15s, transform .15s", "&:hover": { boxShadow: 3, transform: "translateY(-2px)" } }}
						>
							<Box sx={{ height: 110, display: "flex", alignItems: "center", justifyContent: "center", bgcolor: (t) => alpha(color, t.palette.mode === "dark" ? 0.16 : 0.08) }}>
								<Thumbnail item={f} fallback={<Icon sx={{ fontSize: 40, color }} />} />
							</Box>
							<Box sx={{ display: "flex", alignItems: "center", gap: 1, px: 1.25, py: 1 }}>
								<Icon sx={{ fontSize: 18, color, flexShrink: 0 }} />
								<Box sx={{ minWidth: 0 }}>
									<Typography variant="body2" noWrap sx={{ fontWeight: 500 }}>
										{f.name}
									</Typography>
									<Typography variant="caption" color="text.secondary" noWrap sx={{ display: "block" }}>
										{formatDate(f.updated_at)}
									</Typography>
								</Box>
							</Box>
						</ButtonBase>
					);
				})}
			</Box>
		</Box>
	);
}
