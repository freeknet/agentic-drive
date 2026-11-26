import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Breadcrumbs from "@mui/material/Breadcrumbs";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import Divider from "@mui/material/Divider";
import Drawer from "@mui/material/Drawer";
import IconButton from "@mui/material/IconButton";
import Stack from "@mui/material/Stack";
import ToggleButton from "@mui/material/ToggleButton";
import ToggleButtonGroup from "@mui/material/ToggleButtonGroup";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import useMediaQuery from "@mui/material/useMediaQuery";
import { useTheme } from "@mui/material/styles";
import AccessTimeIcon from "@mui/icons-material/AccessTime";
import CloseIcon from "@mui/icons-material/Close";
import CloudUploadOutlinedIcon from "@mui/icons-material/CloudUploadOutlined";
import DeleteForeverOutlinedIcon from "@mui/icons-material/DeleteForeverOutlined";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutlineOutlined";
import DownloadOutlinedIcon from "@mui/icons-material/DownloadOutlined";
import DriveFileMoveOutlinedIcon from "@mui/icons-material/DriveFileMoveOutlined";
import FolderOffOutlinedIcon from "@mui/icons-material/FolderOffOutlined";
import GridViewIcon from "@mui/icons-material/GridView";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import LinkIcon from "@mui/icons-material/Link";
import MoreVertIcon from "@mui/icons-material/MoreVert";
import NavigateNextIcon from "@mui/icons-material/NavigateNext";
import PersonAddAltOutlinedIcon from "@mui/icons-material/PersonAddAltOutlined";
import RestoreIcon from "@mui/icons-material/Restore";
import SearchOffIcon from "@mui/icons-material/SearchOff";
import StarBorderIcon from "@mui/icons-material/StarBorder";
import ViewListIcon from "@mui/icons-material/ViewList";
import { useQuery } from "@tanstack/react-query";
import { useState, type DragEvent, type ReactNode } from "react";
import { Link as RouterLink, useMatches, useParams, useSearchParams } from "react-router";
import { DetailsPanel } from "~/components/DetailsPanel";
import { ConfirmDialog } from "~/components/dialogs";
import { useDrive } from "~/components/DriveProvider";
import { ItemsView, type Mode } from "~/components/ItemsView";
import { api, ApiError, type Item, type Listing } from "~/lib/api";
import { ActionButton, EmptyState, SelectionBar, ViewHeader, ViewTitle } from "~/shell/View";

const DRAG_TYPE = "application/x-drive-items";

/** A breadcrumb that items can be dropped on to move them there. */
function Crumb({ id, name, current, items }: { id: string | null; name: string; current: boolean; items: Item[] }) {
	const d = useDrive();
	const [over, setOver] = useState(false);
	const drop = {
		onDragOver: (e: DragEvent) => {
			if (current || !e.dataTransfer.types.includes(DRAG_TYPE)) return;
			e.preventDefault();
			setOver(true);
		},
		onDragLeave: () => setOver(false),
		onDrop: (e: DragEvent) => {
			setOver(false);
			const raw = e.dataTransfer.getData(DRAG_TYPE);
			if (!raw || current) return;
			e.preventDefault();
			const ids = new Set(JSON.parse(raw) as string[]);
			void d.moveTo(items.filter((i) => ids.has(i.id)), id);
		},
	};
	const sx = { fontSize: 22, px: 1.5, py: 0.5, borderRadius: 999, color: current ? "text.primary" : "text.secondary", textDecoration: "none", bgcolor: over ? "action.selected" : undefined, "&:hover": current ? undefined : { bgcolor: "action.hover" } };
	return current ? (
		<Typography sx={sx} noWrap {...drop}>
			{name}
		</Typography>
	) : (
		<Typography component={RouterLink} to={id ? `/folder/${id}` : "/"} sx={sx} noWrap {...drop}>
			{name}
		</Typography>
	);
}

function useMode(): Mode {
	const id = useMatches().at(-1)?.id;
	if (id === "recent" || id === "starred" || id === "search" || id === "trash") return id;
	return "browse";
}

export default function View() {
	const d = useDrive();
	const mode = useMode();
	const { folderId = null } = useParams();
	const [params] = useSearchParams();
	const q = params.get("q") ?? "";
	const theme = useTheme();
	const wide = useMediaQuery(theme.breakpoints.up("md"));
	const [confirmEmpty, setConfirmEmpty] = useState(false);

	const query = useQuery<{ items: Item[]; listing?: Listing }>({
		queryKey: mode === "browse" ? ["files", folderId] : mode === "search" ? ["search", q] : [mode],
		queryFn: async () => {
			if (mode === "browse") {
				const listing = await api.list(folderId);
				return { items: listing.items, listing };
			}
			if (mode === "search") return api.search(q);
			if (mode === "recent") return api.recent();
			if (mode === "starred") return api.starred();
			return api.trash();
		},
		enabled: mode !== "search" || !!q,
	});
	const items = query.data?.items ?? [];
	const selected = items.filter((i) => d.selected.has(i.id));
	const parentId = mode === "browse" ? folderId : undefined;
	const trash = mode === "trash";

	const title =
		mode === "recent" ? "Recent" : mode === "starred" ? "Starred" : mode === "trash" ? "Trash" : mode === "search" ? `Search results for "${q}"` : null;

	const header =
		selected.length > 0 ? (
			<SelectionBar count={selected.length} onClear={d.clearSelection}>
				{trash ? (
					<>
						<ActionButton title="Restore" onClick={() => d.restore(selected)}>
							<RestoreIcon />
						</ActionButton>
						<ActionButton title="Delete forever" onClick={() => d.purge(selected)}>
							<DeleteForeverOutlinedIcon />
						</ActionButton>
					</>
				) : (
					<>
						{selected.length === 1 && selected[0].kind === "file" && (
							<>
								<ActionButton title="Share" onClick={() => d.share(selected[0])}>
									<PersonAddAltOutlinedIcon />
								</ActionButton>
								<ActionButton title="Copy link" onClick={() => d.copyLink(selected[0])}>
									<LinkIcon />
								</ActionButton>
							</>
						)}
						{selected.some((i) => i.kind === "file") && (
							<ActionButton title="Download" onClick={() => d.download(selected)}>
								<DownloadOutlinedIcon />
							</ActionButton>
						)}
						<ActionButton title="Move" onClick={() => d.move(selected)}>
							<DriveFileMoveOutlinedIcon />
						</ActionButton>
						<ActionButton title="Move to trash" onClick={() => d.trash(selected)}>
							<DeleteOutlineIcon />
						</ActionButton>
						<ActionButton
							title="More actions"
							onClick={(e) => {
								const r = e.currentTarget.getBoundingClientRect();
								d.openMenu({ clientX: r.left, clientY: r.bottom }, { kind: "items", items: selected, siblings: items });
							}}
						>
							<MoreVertIcon />
						</ActionButton>
					</>
				)}
			</SelectionBar>
		) : title ? (
			<ViewTitle>{title}</ViewTitle>
		) : (
			<Breadcrumbs separator={<NavigateNextIcon fontSize="small" />} maxItems={4} aria-label="Folder path" sx={{ minWidth: 0, "& ol": { flexWrap: "nowrap" } }}>
				<Crumb id={null} name="My Drive" current={!query.data?.listing?.breadcrumbs.length} items={items} />
				{query.data?.listing?.breadcrumbs.map((b, i, all) => (
					<Crumb key={b.id} id={b.id} name={b.name} current={i === all.length - 1} items={items} />
				))}
			</Breadcrumbs>
		);

	const empty =
		mode === "trash" ? (
			<EmptyState icon={<DeleteOutlineIcon />} title="Nothing in the trash" body="Move items you don't need to the trash. Items in the trash are deleted forever after 30 days." />
		) : mode === "starred" ? (
			<EmptyState icon={<StarBorderIcon />} title="No starred files" body="Add stars to things you want to find easily later. Right-click a file and choose Add to Starred." />
		) : mode === "recent" ? (
			<EmptyState icon={<AccessTimeIcon />} title="No recent files" body="Files you upload or change show up here." />
		) : mode === "search" ? (
			<EmptyState icon={<SearchOffIcon />} title="No matching results" body="Search looks at file and folder names." />
		) : (
			<EmptyState icon={<CloudUploadOutlinedIcon />} title={folderId ? "This folder is empty" : "Welcome to Drive"} body="Drop files here, or use the New button. Right-click for more options." />
		);

	const notFound = query.error instanceof ApiError && query.error.status === 404;

	return (
		<Box sx={{ flex: 1, minWidth: 0, display: "flex", gap: 2 }}>
			<Box sx={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", bgcolor: "background.paper", borderRadius: { md: 4 }, overflow: "hidden" }}>
				<ViewHeader title={header}>
					{trash && items.length > 0 && selected.length === 0 && (
						<Button onClick={() => setConfirmEmpty(true)}>Empty trash</Button>
					)}
					<ToggleButtonGroup
						size="small"
						exclusive
						value={d.view}
						onChange={(_, v) => v && d.setView(v)}
						aria-label="Layout"
						sx={{ "& .MuiToggleButton-root": { px: 1.5 } }}
					>
						<ToggleButton value="list" aria-label="List layout">
							<ViewListIcon fontSize="small" />
						</ToggleButton>
						<ToggleButton value="grid" aria-label="Grid layout">
							<GridViewIcon fontSize="small" />
						</ToggleButton>
					</ToggleButtonGroup>
					<Tooltip title={d.detailsOpen ? "Hide details" : "View details"}>
						<IconButton aria-label="View details" aria-pressed={d.detailsOpen} onClick={() => d.setDetailsOpen(!d.detailsOpen)} color={d.detailsOpen ? "primary" : "default"}>
							<InfoOutlinedIcon />
						</IconButton>
					</Tooltip>
				</ViewHeader>
				{trash && (
					<Alert severity="info" icon={false} sx={{ mx: 2, mb: 1, borderRadius: 3, bgcolor: "action.hover", color: "text.secondary" }}>
						Items in the trash are deleted forever after 30 days. Their share links stop working right away.
					</Alert>
				)}
				<Divider sx={{ display: d.view === "grid" ? "none" : "block", opacity: 0 }} />
				<Box sx={{ flex: 1, minHeight: 0, overflow: "auto", px: { xs: 1, sm: 2 }, display: "flex", flexDirection: "column" }}>
					{query.isLoading ? (
						<Stack sx={{ flex: 1, alignItems: "center", justifyContent: "center", py: 8 }}>
							<CircularProgress />
						</Stack>
					) : notFound ? (
						<Stack sx={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
							<EmptyState icon={<FolderOffOutlinedIcon />} title="Folder not found" body="It may have been moved to the trash or deleted." />
						</Stack>
					) : (
						<ItemsView items={items} mode={mode} parentId={parentId} empty={empty} />
					)}
				</Box>
			</Box>
			{d.detailsOpen &&
				(wide ? (
					<DetailsPanel items={selected} />
				) : (
					<Drawer anchor="bottom" open onClose={() => d.setDetailsOpen(false)} slotProps={{ paper: { sx: { maxHeight: "80dvh", borderRadius: "28px 28px 0 0" } } }}>
						<DetailsPanel items={selected} />
					</Drawer>
				))}
			{confirmEmpty && (
				<ConfirmDialog
					title="Delete forever?"
					body={`All ${items.length} item${items.length === 1 ? "" : "s"} in the trash, and everything inside them, will be deleted forever. You can't undo this.`}
					confirmLabel="Delete forever"
					onClose={() => setConfirmEmpty(false)}
					onConfirm={async () => {
						const r = await api.emptyTrash();
						d.notify(`Deleted ${r.deleted} item${r.deleted === 1 ? "" : "s"} forever`);
						d.refresh();
					}}
				/>
			)}
		</Box>
	);
}
