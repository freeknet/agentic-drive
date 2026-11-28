import Box from "@mui/material/Box";
import Card from "@mui/material/Card";
import IconButton from "@mui/material/IconButton";
import Stack from "@mui/material/Stack";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import TableSortLabel from "@mui/material/TableSortLabel";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import { alpha } from "@mui/material/styles";
import DownloadOutlinedIcon from "@mui/icons-material/DownloadOutlined";
import MoreVertIcon from "@mui/icons-material/MoreVert";
import PersonAddAltOutlinedIcon from "@mui/icons-material/PersonAddAltOutlined";
import StarIcon from "@mui/icons-material/Star";
import StarBorderIcon from "@mui/icons-material/StarBorder";
import { useEffect, useMemo, useRef, useState, type DragEvent, type MouseEvent, type ReactNode } from "react";
import { contentUrl, type Item } from "~/lib/api";
import { usePrefs } from "~/lib/prefs";
import { fileKind, formatBytes, formatDate, KIND_STYLE } from "~/lib/format";
import { useDrive } from "./DriveProvider";
import { Thumbnail } from "~/components/Thumbnail";
import { rainbowFor } from "~/theme";
import { overlayOpen } from "~/shell/Shortcuts";

export type Mode = "browse" | "recent" | "starred" | "search" | "trash";
type SortKey = "name" | "updated" | "size";
const DRAG_TYPE = "application/x-drive-items";

function sortItems(items: Item[], key: SortKey | null, dir: "asc" | "desc", foldersFirst: boolean): Item[] {
	if (!key) return items;
	const m = dir === "asc" ? 1 : -1;
	return [...items].sort((a, b) => {
		if (foldersFirst && a.kind !== b.kind) return a.kind === "folder" ? -1 : 1;
		if (key === "name") return m * a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: "base" });
		if (key === "size") return m * (a.size - b.size);
		return m * (a.updated_at - b.updated_at);
	});
}

function isTyping(): boolean {
	const el = document.activeElement as HTMLElement | null;
	return !!el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable);
}

function ItemIcon({ item, size = 24 }: { item: Item; size?: number }) {
	const { icon: Icon, color } = KIND_STYLE[fileKind(item)];
	// Folders get a steady rainbow colour each, so they're easy to tell apart.
	return <Icon sx={{ fontSize: size, color: item.kind === "folder" ? rainbowFor(item.id) : color, flexShrink: 0 }} />;
}

/**
 * Files and folders as a grid or a list, with Drive-style selection,
 * right-click menus, drag-to-move and keyboard shortcuts.
 */
export function ItemsView({ items, mode, parentId, empty }: { items: Item[]; mode: Mode; parentId?: string | null; empty: ReactNode }) {
	const d = useDrive();
	const density = usePrefs((p) => p.density);
	const tileMin = density === "compact" ? 176 : 200;
	const [sortKey, setSortKey] = useState<SortKey | null>(mode === "recent" ? null : "name");
	const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
	const [dropTarget, setDropTarget] = useState<string | null>(null);
	const anchor = useRef<string | null>(null);
	const trash = mode === "trash";
	const canCreate = parentId !== undefined && !trash;

	const sorted = useMemo(() => sortItems(items, sortKey, sortDir, mode !== "recent"), [items, sortKey, sortDir, mode]);
	const byId = useMemo(() => new Map(sorted.map((i) => [i.id, i])), [sorted]);
	const selectedItems = sorted.filter((i) => d.selected.has(i.id));

	// Drop selection entries that left the view (moved, trashed, navigated away).
	useEffect(() => {
		const visible = [...d.selected].filter((id) => byId.has(id));
		if (visible.length !== d.selected.size) d.setSelected(new Set(visible));
	}, [byId, d]);

	const select = (item: Item, e: { ctrlKey: boolean; metaKey: boolean; shiftKey: boolean }) => {
		if (e.ctrlKey || e.metaKey) {
			const next = new Set(d.selected);
			if (next.has(item.id)) next.delete(item.id);
			else next.add(item.id);
			d.setSelected(next);
			anchor.current = item.id;
		} else if (e.shiftKey && anchor.current && byId.has(anchor.current)) {
			const a = sorted.findIndex((i) => i.id === anchor.current);
			const b = sorted.findIndex((i) => i.id === item.id);
			d.setSelected(new Set(sorted.slice(Math.min(a, b), Math.max(a, b) + 1).map((i) => i.id)));
		} else {
			d.setSelected(new Set([item.id]));
			anchor.current = item.id;
		}
	};

	const onItemClick = (item: Item, e: MouseEvent) => {
		e.stopPropagation();
		// On touch screens one tap opens, like the Drive app.
		if ((e.nativeEvent as PointerEvent).pointerType === "touch" && !d.selected.size) return d.open(item, sorted);
		select(item, e);
	};

	const onItemContextMenu = (item: Item, e: MouseEvent) => {
		e.preventDefault();
		e.stopPropagation();
		const targets = d.selected.has(item.id) ? selectedItems : [item];
		if (!d.selected.has(item.id)) {
			d.setSelected(new Set([item.id]));
			anchor.current = item.id;
		}
		d.openMenu(e, { kind: "items", items: targets, siblings: sorted, trash });
	};

	const openMoreMenu = (item: Item, e: MouseEvent<HTMLElement>) => {
		e.stopPropagation();
		const r = e.currentTarget.getBoundingClientRect();
		if (!d.selected.has(item.id)) d.setSelected(new Set([item.id]));
		const targets = d.selected.has(item.id) ? selectedItems : [item];
		d.openMenu({ clientX: r.left, clientY: r.bottom }, { kind: "items", items: targets, siblings: sorted, trash });
	};

	// ── drag to move ─────────────────────────────────────────────────
	const dragProps = (item: Item) =>
		trash
			? {}
			: {
					draggable: true,
					onDragStart: (e: DragEvent) => {
						const ids = d.selected.has(item.id) ? [...d.selected] : [item.id];
						if (!d.selected.has(item.id)) d.setSelected(new Set([item.id]));
						e.dataTransfer.setData(DRAG_TYPE, JSON.stringify(ids));
						e.dataTransfer.effectAllowed = "move";
					},
				};
	const dropProps = (folder: Item) =>
		folder.kind !== "folder" || trash
			? {}
			: {
					onDragOver: (e: DragEvent) => {
						if (!e.dataTransfer.types.includes(DRAG_TYPE) || d.selected.has(folder.id)) return;
						e.preventDefault();
						e.dataTransfer.dropEffect = "move";
						setDropTarget(folder.id);
					},
					onDragLeave: () => setDropTarget((t) => (t === folder.id ? null : t)),
					onDrop: (e: DragEvent) => {
						const raw = e.dataTransfer.getData(DRAG_TYPE);
						setDropTarget(null);
						if (!raw) return;
						e.preventDefault();
						e.stopPropagation();
						const moving = (JSON.parse(raw) as string[]).map((id) => byId.get(id)).filter((i): i is Item => !!i && i.id !== folder.id);
						void d.moveTo(moving, folder.id);
					},
				};

	// ── keyboard ─────────────────────────────────────────────────────
	useEffect(() => {
		const onKey = (e: KeyboardEvent) => {
			if (isTyping() || overlayOpen()) return;
			const sel = sorted.filter((i) => d.selected.has(i.id));
			if ((e.key === "Delete" || e.key === "Backspace") && sel.length) {
				e.preventDefault();
				if (trash) d.purge(sel);
				else void d.trash(sel);
			} else if (e.key === "s" && !e.ctrlKey && !e.metaKey && !e.altKey && sel.length && !trash) {
				e.preventDefault();
				void d.star(sel, !sel.every((i) => i.starred));
			} else if (e.key === "m" && !e.ctrlKey && !e.metaKey && !e.altKey && sel.length && !trash) {
				e.preventDefault();
				d.move(sel);
			} else if (e.key === "F2" && sel.length === 1 && !trash) {
				e.preventDefault();
				d.rename(sel[0]);
			} else if (e.key === "Enter" && sel.length === 1) {
				d.open(sel[0], sorted);
			} else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "a") {
				e.preventDefault();
				d.setSelected(new Set(sorted.map((i) => i.id)));
			} else if (e.key === "Escape") {
				d.clearSelection();
			} else if (e.altKey && e.key.toLowerCase() === "c" && canCreate) {
				e.preventDefault();
				d.newFolder(parentId ?? null);
			} else if (e.altKey && e.key.toLowerCase() === "u" && canCreate) {
				e.preventDefault();
				d.uploadFiles(parentId ?? null);
			}
		};
		window.addEventListener("keydown", onKey);
		return () => window.removeEventListener("keydown", onKey);
	}, [sorted, d, trash, canCreate, parentId]);

	const background = {
		onClick: () => d.clearSelection(),
		onContextMenu: (e: MouseEvent) => {
			if (!canCreate) return;
			e.preventDefault();
			d.clearSelection();
			d.openMenu(e, { kind: "background", parentId: parentId ?? null });
		},
	};

	if (sorted.length === 0) {
		return (
			<Box {...background} sx={{ flex: 1, minHeight: 360, display: "flex", alignItems: "center", justifyContent: "center" }}>
				{empty}
			</Box>
		);
	}

	const selectedSx = (id: string) => {
		const selected = d.selected.has(id);
		return {
			bgcolor: selected || dropTarget === id ? (t: { palette: { primary: { main: string } } }) => alpha(t.palette.primary.main, 0.24) : "action.hover",
			outline: "2px solid",
			outlineOffset: -2,
			// Only a selected item or a drop target gets a ring.
			outlineColor: dropTarget === id ? "primary.main" : selected ? "primary.main" : "transparent",
			transition: "background-color .15s, outline-color .15s, box-shadow .15s",
			"&:hover": selected ? {} : { bgcolor: "action.selected", boxShadow: 1 },
		};
	};

	const sortBy = (key: SortKey) => {
		if (sortKey === key) setSortDir(sortDir === "asc" ? "desc" : "asc");
		else {
			setSortKey(key);
			setSortDir(key === "name" ? "asc" : "desc");
		}
	};

	if (d.view === "grid") {
		const folders = sorted.filter((i) => i.kind === "folder");
		const files = sorted.filter((i) => i.kind === "file");
		const section = (title: string) => (
			<Typography variant="subtitle2" sx={{ color: "text.secondary", mt: 2, mb: 1.5 }}>
				{title}
			</Typography>
		);
		return (
			<Box {...background} sx={{ flex: 1, pb: 12 }}>
				{folders.length > 0 && section("Folders")}
				<Box sx={{ display: "grid", gridTemplateColumns: { xs: "repeat(2, minmax(0, 1fr))", sm: `repeat(auto-fill, minmax(${tileMin}px, 1fr))` }, gap: { xs: 1, sm: 2 } }}>
					{folders.map((f) => (
						<Card
							key={f.id}
							{...dragProps(f)}
							{...dropProps(f)}
							onClick={(e) => onItemClick(f, e)}
							onDoubleClick={() => d.open(f, sorted)}
							onContextMenu={(e) => onItemContextMenu(f, e)}
							sx={{ display: "flex", alignItems: "center", gap: 1.5, pl: 2, pr: 0.5, height: 52, borderRadius: 3, cursor: "default", userSelect: "none", border: 0, ...selectedSx(f.id) }}
						>
							<ItemIcon item={f} />
							<Typography noWrap sx={{ flex: 1, fontSize: 14, fontWeight: 500 }}>
								{f.name}
							</Typography>
							{f.starred ? <StarIcon sx={{ fontSize: 16, color: "text.secondary" }} /> : null}
							<IconButton size="small" aria-label={`More actions for ${f.name}`} onClick={(e) => openMoreMenu(f, e)}>
								<MoreVertIcon fontSize="small" />
							</IconButton>
						</Card>
					))}
				</Box>
				{files.length > 0 && section("Files")}
				<Box sx={{ display: "grid", gridTemplateColumns: { xs: "repeat(2, minmax(0, 1fr))", sm: `repeat(auto-fill, minmax(${tileMin}px, 1fr))` }, gap: { xs: 1, sm: 2 } }}>
					{files.map((f) => {
						return (
							<Card
								key={f.id}
								{...dragProps(f)}
								onClick={(e) => onItemClick(f, e)}
								onDoubleClick={() => d.open(f, sorted)}
								onContextMenu={(e) => onItemContextMenu(f, e)}
								sx={{ p: 1, pt: 0.25, cursor: "default", userSelect: "none", border: 0, borderRadius: 3, display: "flex", flexDirection: "column", ...selectedSx(f.id) }}
							>
								<Stack direction="row" spacing={1} sx={{ alignItems: "center", pl: 1, height: 44, minWidth: 0 }}>
									<ItemIcon item={f} size={20} />
									<Typography noWrap sx={{ flex: 1, fontSize: 14, fontWeight: 500 }} title={f.name}>
										{f.name}
									</Typography>
									<IconButton size="small" aria-label={`More actions for ${f.name}`} onClick={(e) => openMoreMenu(f, e)}>
										<MoreVertIcon fontSize="small" />
									</IconButton>
								</Stack>
								<Box
									sx={{
										aspectRatio: "4 / 3",
										borderRadius: 2,
										overflow: "hidden",
										// A soft wash of the file type's colour behind its icon (photos cover it).
										bgcolor: (t) => alpha(KIND_STYLE[fileKind(f)].color, t.palette.mode === "dark" ? 0.16 : 0.08),
										display: "flex",
										alignItems: "center",
										justifyContent: "center",
									}}
								>
									<Thumbnail item={f} fallback={<ItemIcon item={f} size={48} />} />
								</Box>
								<Stack direction="row" spacing={0.75} sx={{ alignItems: "center", px: 1, pt: 1, pb: 0.25, minWidth: 0 }}>
									<Typography variant="caption" sx={{ color: "text.secondary", flex: 1, minWidth: 0 }} noWrap>
										{formatDate(trash && f.trashed_at ? f.trashed_at : f.updated_at)} · {formatBytes(f.size)}
										{mode === "search" || mode === "recent" || mode === "starred" ? ` · ${f.parent_name ?? "My Drive"}` : ""}
									</Typography>
									{f.starred ? <StarIcon aria-label="Starred" sx={{ fontSize: 16, color: "#f4b400", flexShrink: 0 }} /> : null}
								</Stack>
							</Card>
						);
					})}
				</Box>
			</Box>
		);
	}

	return (
		<Box {...background} sx={{ flex: 1, pb: 12 }}>
			<Table size={density === "compact" ? "small" : "medium"} stickyHeader sx={{ tableLayout: "fixed", "& td, & th": { borderColor: "divider" } }} aria-label="Files">
				<TableHead>
					<TableRow>
						<TableCell sx={{ bgcolor: "background.default" }}>
							<TableSortLabel active={sortKey === "name"} direction={sortKey === "name" ? sortDir : "asc"} onClick={() => sortBy("name")}>
								Name
							</TableSortLabel>
						</TableCell>
						<TableCell sx={{ width: 170, bgcolor: "background.default", display: { xs: "none", md: "table-cell" } }}>
							<TableSortLabel active={sortKey === "updated"} direction={sortKey === "updated" ? sortDir : "desc"} onClick={() => sortBy("updated")}>
								{trash ? "Date trashed" : "Last modified"}
							</TableSortLabel>
						</TableCell>
						<TableCell sx={{ width: 110, bgcolor: "background.default", display: { xs: "none", sm: "table-cell" } }}>
							<TableSortLabel active={sortKey === "size"} direction={sortKey === "size" ? sortDir : "desc"} onClick={() => sortBy("size")}>
								File size
							</TableSortLabel>
						</TableCell>
						<TableCell sx={{ width: { xs: 56, md: 170 }, bgcolor: "background.default" }} />
					</TableRow>
				</TableHead>
				<TableBody>
					{sorted.map((item) => (
						<TableRow
							key={item.id}
							hover
							selected={d.selected.has(item.id)}
							{...dragProps(item)}
							{...dropProps(item)}
							onClick={(e) => onItemClick(item, e)}
							onDoubleClick={() => d.open(item, sorted)}
							onContextMenu={(e) => onItemContextMenu(item, e)}
							sx={{
								cursor: "default",
								userSelect: "none",
								"& .row-actions": { visibility: "hidden" },
								"&:hover .row-actions, &.Mui-selected .row-actions": { visibility: "visible" },
								...(dropTarget === item.id && { outline: "2px solid", outlineColor: "primary.main", outlineOffset: -2 }),
							}}
						>
							<TableCell sx={{ py: 1 }}>
								<Stack direction="row" spacing={2} sx={{ alignItems: "center", minWidth: 0 }}>
									<ItemIcon item={item} />
									<Box sx={{ minWidth: 0 }}>
										<Typography noWrap sx={{ fontSize: 14, fontWeight: 500 }} title={item.name}>
											{item.name}
											{item.starred ? <StarIcon sx={{ fontSize: 14, ml: 0.75, verticalAlign: "-2px", color: "text.secondary" }} /> : null}
										</Typography>
										{(mode === "search" || mode === "recent" || mode === "starred") && (
											<Typography variant="caption" noWrap sx={{ color: "text.secondary", display: "block" }}>
												in {item.parent_name ?? "My Drive"}
											</Typography>
										)}
										<Typography variant="caption" noWrap sx={{ color: "text.secondary", display: { xs: "block", md: "none" } }}>
											{formatDate(trash && item.trashed_at ? item.trashed_at : item.updated_at)}
											{item.kind === "file" ? ` · ${formatBytes(item.size)}` : ""}
										</Typography>
									</Box>
								</Stack>
							</TableCell>
							<TableCell sx={{ color: "text.secondary", display: { xs: "none", md: "table-cell" } }}>
								{formatDate(trash && item.trashed_at ? item.trashed_at : item.updated_at)}
							</TableCell>
							<TableCell sx={{ color: "text.secondary", display: { xs: "none", sm: "table-cell" } }}>{item.kind === "file" ? formatBytes(item.size) : "—"}</TableCell>
							<TableCell align="right" sx={{ py: 0 }}>
								<Stack direction="row" sx={{ justifyContent: "flex-end" }}>
									{!trash && item.kind === "file" && (
										<Stack direction="row" className="row-actions" sx={{ display: { xs: "none", md: "flex" } }}>
											<Tooltip title="Share">
												<IconButton size="small" aria-label={`Share ${item.name}`} onClick={(e) => (e.stopPropagation(), d.share(item))}>
													<PersonAddAltOutlinedIcon fontSize="small" />
												</IconButton>
											</Tooltip>
											<Tooltip title="Download">
												<IconButton size="small" aria-label={`Download ${item.name}`} onClick={(e) => (e.stopPropagation(), d.download([item]))}>
													<DownloadOutlinedIcon fontSize="small" />
												</IconButton>
											</Tooltip>
											<Tooltip title={item.starred ? "Remove from Starred" : "Add to Starred"}>
												<IconButton size="small" aria-label={item.starred ? `Unstar ${item.name}` : `Star ${item.name}`} onClick={(e) => (e.stopPropagation(), void d.star([item], !item.starred))}>
													{item.starred ? <StarIcon fontSize="small" /> : <StarBorderIcon fontSize="small" />}
												</IconButton>
											</Tooltip>
										</Stack>
									)}
									<IconButton size="small" aria-label={`More actions for ${item.name}`} onClick={(e) => openMoreMenu(item, e)}>
										<MoreVertIcon fontSize="small" />
									</IconButton>
								</Stack>
							</TableCell>
						</TableRow>
					))}
				</TableBody>
			</Table>
		</Box>
	);
}
