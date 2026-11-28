import Box from "@mui/material/Box";
import Fab from "@mui/material/Fab";
import LinearProgress from "@mui/material/LinearProgress";
import List from "@mui/material/List";
import ListItemIcon from "@mui/material/ListItemIcon";
import ListItemText from "@mui/material/ListItemText";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import AccessTimeIcon from "@mui/icons-material/AccessTime";
import AddIcon from "@mui/icons-material/Add";
import CloudOutlinedIcon from "@mui/icons-material/CloudOutlined";
import CreateNewFolderOutlinedIcon from "@mui/icons-material/CreateNewFolderOutlined";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutlineOutlined";
import HomeOutlinedIcon from "@mui/icons-material/HomeOutlined";
import StarBorderIcon from "@mui/icons-material/StarBorder";
import UploadFileOutlinedIcon from "@mui/icons-material/UploadFileOutlined";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { Outlet, useLocation, useMatches, useNavigate, useParams, useSearchParams } from "react-router";
import { DriveProvider, useDrive } from "~/components/DriveProvider";
import { SettingsDialog } from "~/components/SettingsDialog";
import { UploadPanel } from "~/components/UploadPanel";
import { api } from "~/lib/api";
import { formatBytes } from "~/lib/format";
import { enqueue, onUploaded } from "~/lib/uploads";
import { AppHeader } from "~/shell/AppHeader";
import { takeShare, useLaunchFiles } from "~/shell/pwa";
import { toggleSidebar } from "~/shell/layout";
import { AccountMenu } from "~/shell/AccountMenu";
import Button from "@mui/material/Button";
import SettingsOutlinedIcon from "@mui/icons-material/SettingsOutlined";
import { DriveShortcuts } from "~/components/DriveShortcuts";
import { SidebarFooter, SidebarFrame, SidebarItem, SidebarPrimaryButton } from "~/shell/Sidebar";
import SpeedDial from "@mui/material/SpeedDial";
import SpeedDialAction from "@mui/material/SpeedDialAction";
import SpeedDialIcon from "@mui/material/SpeedDialIcon";
import { NAV_BAR_HEIGHT, NavBar } from "~/shell/NavBar";
import { RAINBOW_GRADIENT } from "~/theme";


/** The folder new items go into, or undefined where nothing can be created (Recent, Trash…). */
function useCreateTarget(): string | null | undefined {
	const { folderId } = useParams();
	const id = useMatches().at(-1)?.id;
	if (id === "my-drive") return null;
	if (id === "folder") return folderId ?? null;
	return undefined;
}

function StorageMeter() {
	const { data } = useQuery({ queryKey: ["stats"], queryFn: api.stats });
	if (!data) return null;
	const pct = Math.min(100, (data.bytes / data.limit) * 100);
	return (
		<SidebarFooter>
			<Stack direction="row" spacing={1} sx={{ alignItems: "center", mb: 1 }}>
				<CloudOutlinedIcon fontSize="small" sx={{ color: "text.secondary" }} />
				<Typography variant="body2">Storage</Typography>
			</Stack>
			<LinearProgress
				variant="determinate"
				value={pct}
				color={pct > 90 ? "error" : pct > 75 ? "warning" : "primary"}
				aria-label="Storage used"
				sx={{ height: 6, borderRadius: 1, mb: 1, ...(pct <= 75 && { "& .MuiLinearProgress-bar": { background: RAINBOW_GRADIENT } }) }}
			/>
			<Typography variant="caption" sx={{ color: "text.secondary", display: "block" }}>
				{formatBytes(data.bytes)} of {formatBytes(data.limit)} used
			</Typography>
			{data.trashBytes > 0 && (
				<Typography variant="caption" sx={{ color: "text.secondary" }}>
					{formatBytes(data.trashBytes)} in the trash
				</Typography>
			)}
		</SidebarFooter>
	);
}

function NewMenu({ anchor, onClose, parentId }: { anchor: HTMLElement | null; onClose: () => void; parentId: string | null }) {
	const d = useDrive();
	return (
		<Menu open={!!anchor} anchorEl={anchor} onClose={onClose} slotProps={{ paper: { sx: { minWidth: 240 } }, list: { dense: true } }}>
			<MenuItem
				onClick={() => {
					onClose();
					d.newFolder(parentId);
				}}
			>
				<ListItemIcon>
					<CreateNewFolderOutlinedIcon fontSize="small" />
				</ListItemIcon>
				<ListItemText>New folder</ListItemText>
				<Typography variant="body2" sx={{ color: "text.secondary" }}>
					Alt+C
				</Typography>
			</MenuItem>
			<MenuItem
				onClick={() => {
					onClose();
					d.uploadFiles(parentId);
				}}
			>
				<ListItemIcon>
					<UploadFileOutlinedIcon fontSize="small" />
				</ListItemIcon>
				<ListItemText>File upload</ListItemText>
				<Typography variant="body2" sx={{ color: "text.secondary" }}>
					Alt+U
				</Typography>
			</MenuItem>
		</Menu>
	);
}

const NAV = [
	{ to: "/", label: "My Drive", icon: <HomeOutlinedIcon />, color: "#4285f4", match: (p: string) => p === "/" || p.startsWith("/folder/") },
	{ to: "/recent", label: "Recent", icon: <AccessTimeIcon />, color: "#a142f4", match: (p: string) => p === "/recent" },
	{ to: "/starred", label: "Starred", icon: <StarBorderIcon />, color: "#fbbc04", match: (p: string) => p === "/starred" },
	{ to: "/trash", label: "Trash", icon: <DeleteOutlineIcon />, color: "#ea4335", match: (p: string) => p === "/trash" },
];

/** Phones: M3 FAB menu (speed dial) for New folder and Upload, above the navigation bar. */
function NewSpeedDial({ parentId }: { parentId: string | null }) {
	const d = useDrive();
	const [open, setOpen] = useState(false);
	return (
		<SpeedDial
			ariaLabel="New"
			open={open}
			onOpen={() => setOpen(true)}
			onClose={() => setOpen(false)}
			icon={<SpeedDialIcon />}
			sx={{
				display: { md: "none" },
				position: "fixed",
				right: 16,
				bottom: `calc(${NAV_BAR_HEIGHT + 16}px + env(safe-area-inset-bottom, 0px))`,
				"& .MuiSpeedDialAction-staticTooltipLabel": { whiteSpace: "nowrap", borderRadius: 2, boxShadow: 2 },
				"& .MuiSpeedDial-fab": { borderRadius: 4, bgcolor: "secondary.main", color: "secondary.contrastText", "&:hover": { bgcolor: "secondary.main" } },
			}}
		>
			<SpeedDialAction
				icon={<CreateNewFolderOutlinedIcon sx={{ color: "#4285f4" }} />}
				slotProps={{ tooltip: { open: true, title: "New folder" } }}
				onClick={() => {
					setOpen(false);
					d.newFolder(parentId);
				}}
			/>
			<SpeedDialAction
				icon={<UploadFileOutlinedIcon sx={{ color: "#34a853" }} />}
				slotProps={{ tooltip: { open: true, title: "Upload files" } }}
				onClick={() => {
					setOpen(false);
					d.uploadFiles(parentId);
				}}
			/>
		</SpeedDial>
	);
}

function SidebarContents({ createTarget, onNavigate }: { createTarget: string | null | undefined; onNavigate?: () => void }) {
	const [anchor, setAnchor] = useState<HTMLElement | null>(null);
	const { pathname } = useLocation();
	return (
		<>
			<SidebarPrimaryButton icon={<AddIcon />} label="New" onClick={(e) => setAnchor(e.currentTarget)} />
			<NewMenu anchor={anchor} onClose={() => setAnchor(null)} parentId={createTarget ?? null} />
			<List aria-label="Drive sections" disablePadding>
				{NAV.map((n) => (
					<SidebarItem key={n.to} to={n.to} icon={n.icon} label={n.label} color={n.color} selected={n.match(pathname)} onClick={onNavigate} />
				))}
			</List>
			<StorageMeter />
		</>
	);
}

function Shell() {
	const { pathname: currentPath } = useLocation();
	const navigate = useNavigate();
	const [params] = useSearchParams();
	const [q, setQ] = useState(params.get("q") ?? "");
	const [mobileOpen, setMobileOpen] = useState(false);
	const [fabAnchor, setFabAnchor] = useState<HTMLElement | null>(null);
	const [dragging, setDragging] = useState(false);
	const [settingsOpen, setSettingsOpen] = useState(false);
	const createTarget = useCreateTarget();
	const qc = useQueryClient();
	const { data: config } = useQuery({ queryKey: ["config"], queryFn: api.config, staleTime: Number.POSITIVE_INFINITY });

	// Installed app: files opened with Drive ("Open with") or shared to it go into My Drive.
	useLaunchFiles((files) => enqueue(files, null));
	const shareId = params.get("share");
	const handledShare = useRef<string | null>(null);
	useEffect(() => {
		// Once per share, even if the effect runs twice while the page starts.
		if (!shareId || handledShare.current === shareId) return;
		handledShare.current = shareId;
		takeShare(shareId)
			.then((shared) => {
				if (shared?.files.length) enqueue(shared.files, null);
			})
			.catch(() => {})
			.finally(() => navigate("/", { replace: true }));
	}, [shareId, navigate]);

	useEffect(() => {
		const off = onUploaded(() => void qc.invalidateQueries());
		return () => {
			off();
		};
	}, [qc]);

	// Drop files from the computer anywhere on a folder view to upload them there.
	useEffect(() => {
		let depth = 0;
		const external = (e: DragEvent) => !!e.dataTransfer?.types.includes("Files");
		const enter = (e: DragEvent) => {
			if (!external(e) || createTarget === undefined) return;
			depth++;
			setDragging(true);
		};
		const leave = (e: DragEvent) => {
			if (!external(e)) return;
			depth = Math.max(0, depth - 1);
			if (depth === 0) setDragging(false);
		};
		const over = (e: DragEvent) => {
			if (external(e) && createTarget !== undefined) e.preventDefault();
		};
		const drop = (e: DragEvent) => {
			if (!external(e) || createTarget === undefined) return;
			e.preventDefault();
			depth = 0;
			setDragging(false);
			const files = [...(e.dataTransfer?.files ?? [])];
			if (files.length) enqueue(files, createTarget);
		};
		window.addEventListener("dragenter", enter);
		window.addEventListener("dragleave", leave);
		window.addEventListener("dragover", over);
		window.addEventListener("drop", drop);
		return () => {
			window.removeEventListener("dragenter", enter);
			window.removeEventListener("dragleave", leave);
			window.removeEventListener("dragover", over);
			window.removeEventListener("drop", drop);
		};
	}, [createTarget]);

	return (
		<Box sx={{ display: "flex", flexDirection: "column", height: "100dvh", bgcolor: "background.default" }}>
			<AppHeader
				app="drive"
				homeHref="/"
				appUrls={{ mail: config?.mailUrl }}
				search={{
					placeholder: "Search in Drive",
					value: q,
					onChange: setQ,
					onSubmit: () => {
						if (q.trim()) navigate(`/search?q=${encodeURIComponent(q.trim())}`);
					},
					onClear: () => setQ(""),
				}}
				settings={{ onClick: () => setSettingsOpen(true) }}
				account={
					<AccountMenu>
						<Button
							fullWidth
							color="inherit"
							startIcon={<SettingsOutlinedIcon />}
							onClick={() => setSettingsOpen(true)}
							sx={{ justifyContent: "flex-start", px: 2.5, py: 1.5, borderRadius: 0 }}
						>
							Drive settings
						</Button>
					</AccountMenu>
				}
				onMenuClick={() => toggleSidebar(() => setMobileOpen(true))}
			/>
			<SettingsDialog open={settingsOpen} onClose={() => setSettingsOpen(false)} />
			<DriveShortcuts createTarget={createTarget} mailUrl={config?.mailUrl} onSettings={() => setSettingsOpen(true)} />
			<Box sx={{ display: "flex", flex: 1, minHeight: 0 }}>
				<SidebarFrame open={mobileOpen} onClose={() => setMobileOpen(false)}>
					<SidebarContents createTarget={createTarget} onNavigate={() => setMobileOpen(false)} />
				</SidebarFrame>
				<Box component="main" sx={{ flex: 1, minWidth: 0, display: "flex", pr: { md: 2 }, pb: { xs: `${NAV_BAR_HEIGHT}px`, md: 2 } }}>
					<Outlet />
				</Box>
			</Box>
			{createTarget !== undefined && <NewSpeedDial parentId={createTarget} />}
			<NavBar items={NAV.map((n) => ({ label: n.label, icon: n.icon, color: n.color, to: n.to, selected: n.match(currentPath) }))} />
			{dragging && (
				<Box
					sx={{
						pointerEvents: "none",
						position: "fixed",
						inset: 0,
						zIndex: (t) => t.zIndex.modal,
						bgcolor: "rgba(11,87,208,0.08)",
						border: "3px solid",
						borderColor: "primary.main",
						display: "flex",
						alignItems: "flex-end",
						justifyContent: "center",
						pb: 6,
					}}
				>
					<Stack direction="row" spacing={1} sx={{ alignItems: "center", bgcolor: "primary.main", color: "primary.contrastText", px: 3, py: 1.5, borderRadius: 3, boxShadow: 4 }}>
						<UploadFileOutlinedIcon />
						<Typography sx={{ fontWeight: 500 }}>Drop files to upload them here</Typography>
					</Stack>
				</Box>
			)}
			<UploadPanel />
		</Box>
	);
}

export default function Layout() {
	const navigate = useNavigate();
	return (
		<DriveProvider navigateTo={navigate}>
			<Shell />
		</DriveProvider>
	);
}
