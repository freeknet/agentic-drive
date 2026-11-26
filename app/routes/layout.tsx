import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Drawer from "@mui/material/Drawer";
import Fab from "@mui/material/Fab";
import IconButton from "@mui/material/IconButton";
import InputAdornment from "@mui/material/InputAdornment";
import LinearProgress from "@mui/material/LinearProgress";
import List from "@mui/material/List";
import ListItemButton from "@mui/material/ListItemButton";
import ListItemIcon from "@mui/material/ListItemIcon";
import ListItemText from "@mui/material/ListItemText";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import { useColorScheme } from "@mui/material/styles";
import AccessTimeIcon from "@mui/icons-material/AccessTime";
import AddIcon from "@mui/icons-material/Add";
import AddToDriveIcon from "@mui/icons-material/AddToDrive";
import BrightnessAutoIcon from "@mui/icons-material/BrightnessAuto";
import CloudOutlinedIcon from "@mui/icons-material/CloudOutlined";
import CloseIcon from "@mui/icons-material/Close";
import CreateNewFolderOutlinedIcon from "@mui/icons-material/CreateNewFolderOutlined";
import DarkModeOutlinedIcon from "@mui/icons-material/DarkModeOutlined";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutlineOutlined";
import HomeOutlinedIcon from "@mui/icons-material/HomeOutlined";
import LightModeOutlinedIcon from "@mui/icons-material/LightModeOutlined";
import MenuIcon from "@mui/icons-material/Menu";
import SearchIcon from "@mui/icons-material/Search";
import SettingsOutlinedIcon from "@mui/icons-material/SettingsOutlined";
import StarBorderIcon from "@mui/icons-material/StarBorder";
import UploadFileOutlinedIcon from "@mui/icons-material/UploadFileOutlined";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { NavLink, Outlet, useLocation, useMatches, useNavigate, useParams, useSearchParams } from "react-router";
import { AppsMenu } from "~/components/AppsMenu";
import { DriveProvider, useDrive } from "~/components/DriveProvider";
import { UploadPanel } from "~/components/UploadPanel";
import { api } from "~/lib/api";
import { formatBytes } from "~/lib/format";
import { enqueue, onUploaded } from "~/lib/uploads";
import { SettingsDialog } from "~/components/SettingsDialog";

const DRAWER = 256;

/** The folder new items go into, or undefined where nothing can be created (Recent, Trash…). */
function useCreateTarget(): string | null | undefined {
	const { folderId } = useParams();
	const id = useMatches().at(-1)?.id;
	if (id === "my-drive") return null;
	if (id === "folder") return folderId ?? null;
	return undefined;
}

function ThemeToggle() {
	const { mode, setMode } = useColorScheme();
	if (!mode) return <Box sx={{ width: 40 }} />;
	const next = mode === "system" ? "light" : mode === "light" ? "dark" : "system";
	const Icon = mode === "dark" ? DarkModeOutlinedIcon : mode === "light" ? LightModeOutlinedIcon : BrightnessAutoIcon;
	return (
		<Tooltip title={`Theme: ${mode} (switch to ${next})`}>
			<IconButton aria-label={`Theme: ${mode}`} onClick={() => setMode(next)}>
				<Icon />
			</IconButton>
		</Tooltip>
	);
}

function StorageMeter() {
	const { data } = useQuery({ queryKey: ["stats"], queryFn: api.stats });
	if (!data) return null;
	const pct = Math.min(100, (data.bytes / data.limit) * 100);
	return (
		<Box sx={{ px: 3, py: 2 }}>
			<Stack direction="row" spacing={1} sx={{ alignItems: "center", mb: 1 }}>
				<CloudOutlinedIcon fontSize="small" sx={{ color: "text.secondary" }} />
				<Typography variant="body2">Storage</Typography>
			</Stack>
			<LinearProgress
				variant="determinate"
				value={pct}
				color={pct > 90 ? "error" : pct > 75 ? "warning" : "primary"}
				aria-label="Storage used"
				sx={{ height: 4, borderRadius: 2, mb: 1 }}
			/>
			<Typography variant="caption" sx={{ color: "text.secondary", display: "block" }}>
				{formatBytes(data.bytes)} of {formatBytes(data.limit)} used
			</Typography>
			{data.trashBytes > 0 && (
				<Typography variant="caption" sx={{ color: "text.secondary" }}>
					{formatBytes(data.trashBytes)} in the trash
				</Typography>
			)}
		</Box>
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
	{ to: "/", label: "My Drive", icon: <HomeOutlinedIcon />, match: (p: string) => p === "/" || p.startsWith("/folder/") },
	{ to: "/recent", label: "Recent", icon: <AccessTimeIcon />, match: (p: string) => p === "/recent" },
	{ to: "/starred", label: "Starred", icon: <StarBorderIcon />, match: (p: string) => p === "/starred" },
	{ to: "/trash", label: "Trash", icon: <DeleteOutlineIcon />, match: (p: string) => p === "/trash" },
];

function Sidebar({ createTarget, onNavigate }: { createTarget: string | null | undefined; onNavigate?: () => void }) {
	const [anchor, setAnchor] = useState<HTMLElement | null>(null);
	const { pathname } = useLocation();
	return (
		<Stack sx={{ height: 1, py: 1 }}>
			<Box sx={{ px: 2, pb: 2 }}>
				<Button
					variant="contained"
					color="inherit"
					startIcon={<AddIcon />}
					onClick={(e) => setAnchor(e.currentTarget)}
					sx={{ borderRadius: 4, px: 2.5, py: 1.75, bgcolor: "background.paper", color: "text.primary", boxShadow: 2, "&:hover": { bgcolor: "action.hover", boxShadow: 4 } }}
				>
					New
				</Button>
				<NewMenu anchor={anchor} onClose={() => setAnchor(null)} parentId={createTarget ?? null} />
			</Box>
			<List component="nav" aria-label="Drive sections" sx={{ px: 1 }}>
				{NAV.map((n) => (
					<ListItemButton key={n.to} component={NavLink} to={n.to} selected={n.match(pathname)} onClick={onNavigate} sx={{ mb: 0.25, py: 0.5 }}>
						<ListItemIcon sx={{ minWidth: 40 }}>{n.icon}</ListItemIcon>
						<ListItemText primary={n.label} slotProps={{ primary: { sx: { fontSize: 14, fontWeight: n.match(pathname) ? 600 : 400 } } }} />
					</ListItemButton>
				))}
			</List>
			<Box sx={{ mt: "auto" }}>
				<StorageMeter />
			</Box>
		</Stack>
	);
}

function Shell() {
	const navigate = useNavigate();
	const [params] = useSearchParams();
	const [q, setQ] = useState(params.get("q") ?? "");
	const [mobileOpen, setMobileOpen] = useState(false);
	const [fabAnchor, setFabAnchor] = useState<HTMLElement | null>(null);
	const [dragging, setDragging] = useState(false);
	const [settingsOpen, setSettingsOpen] = useState(false);
	const createTarget = useCreateTarget();
	const qc = useQueryClient();

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
			<Stack component="header" direction="row" spacing={1} sx={{ alignItems: "center", px: { xs: 1, sm: 2 }, py: 1, height: 64 }}>
				<IconButton aria-label="Open navigation" onClick={() => setMobileOpen(true)} sx={{ display: { md: "none" } }}>
					<MenuIcon />
				</IconButton>
				<Stack component={NavLink} to="/" direction="row" spacing={1} sx={{ alignItems: "center", textDecoration: "none", color: "text.primary", width: { md: DRAWER - 16 }, flexShrink: 0 }}>
					<AddToDriveIcon sx={{ fontSize: 40, color: "#1a73e8" }} />
					<Typography variant="h6" sx={{ display: { xs: "none", sm: "block" }, color: "text.secondary" }}>
						Drive
					</Typography>
				</Stack>
				<Box
					component="form"
					role="search"
					sx={{ flex: 1, maxWidth: 720 }}
					onSubmit={(e) => {
						e.preventDefault();
						if (q.trim()) navigate(`/search?q=${encodeURIComponent(q.trim())}`);
					}}
				>
					<TextField
						fullWidth
						size="small"
						placeholder="Search in Drive"
						value={q}
						onChange={(e) => setQ(e.target.value)}
						slotProps={{
							htmlInput: { "aria-label": "Search in Drive" },
							input: {
								startAdornment: (
									<InputAdornment position="start">
										<SearchIcon />
									</InputAdornment>
								),
								endAdornment: q ? (
									<InputAdornment position="end">
										<IconButton size="small" aria-label="Clear search" onClick={() => setQ("")}>
											<CloseIcon fontSize="small" />
										</IconButton>
									</InputAdornment>
								) : undefined,
								sx: { borderRadius: 999, bgcolor: "action.hover", "& fieldset": { border: 0 }, height: 48 },
							},
						}}
					/>
				</Box>
				<Box sx={{ flex: { md: 1 } }} />
				<ThemeToggle />
				<Tooltip title="Settings">
					<IconButton aria-label="Settings" onClick={() => setSettingsOpen(true)}>
						<SettingsOutlinedIcon />
					</IconButton>
				</Tooltip>
				<AppsMenu />
			</Stack>
			<SettingsDialog open={settingsOpen} onClose={() => setSettingsOpen(false)} />
			<Box sx={{ display: "flex", flex: 1, minHeight: 0 }}>
				<Box component="nav" sx={{ width: { md: DRAWER }, flexShrink: 0, display: { xs: "none", md: "block" } }}>
					<Sidebar createTarget={createTarget} />
				</Box>
				<Drawer open={mobileOpen} onClose={() => setMobileOpen(false)} sx={{ display: { md: "none" } }} slotProps={{ paper: { sx: { width: DRAWER, bgcolor: "background.default" } } }}>
					<Sidebar createTarget={createTarget} onNavigate={() => setMobileOpen(false)} />
				</Drawer>
				<Box component="main" sx={{ flex: 1, minWidth: 0, display: "flex", pr: { md: 2 }, pb: { md: 2 } }}>
					<Outlet />
				</Box>
			</Box>
			{createTarget !== undefined && (
				<>
					<Fab color="secondary" aria-label="New" onClick={(e) => setFabAnchor(e.currentTarget)} sx={{ position: "fixed", right: 16, bottom: 24, display: { md: "none" }, borderRadius: 4 }}>
						<AddIcon />
					</Fab>
					<NewMenu anchor={fabAnchor} onClose={() => setFabAnchor(null)} parentId={createTarget} />
				</>
			)}
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
					<Stack direction="row" spacing={1} sx={{ alignItems: "center", bgcolor: "primary.main", color: "primary.contrastText", px: 3, py: 1.5, borderRadius: 999, boxShadow: 4 }}>
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
