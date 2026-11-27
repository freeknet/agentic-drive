import AccessTimeIcon from "@mui/icons-material/AccessTime";
import BrightnessAutoIcon from "@mui/icons-material/BrightnessAuto";
import CreateNewFolderOutlinedIcon from "@mui/icons-material/CreateNewFolderOutlined";
import DarkModeOutlinedIcon from "@mui/icons-material/DarkModeOutlined";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutlineOutlined";
import GridViewIcon from "@mui/icons-material/GridViewOutlined";
import HomeOutlinedIcon from "@mui/icons-material/HomeOutlined";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import KeyboardOutlinedIcon from "@mui/icons-material/KeyboardOutlined";
import LightModeOutlinedIcon from "@mui/icons-material/LightModeOutlined";
import MailIcon from "@mui/icons-material/MailOutlined";
import MenuOpenIcon from "@mui/icons-material/MenuOpen";
import RefreshIcon from "@mui/icons-material/Refresh";
import SearchIcon from "@mui/icons-material/Search";
import SettingsOutlinedIcon from "@mui/icons-material/SettingsOutlined";
import StarBorderIcon from "@mui/icons-material/StarBorder";
import UploadFileOutlinedIcon from "@mui/icons-material/UploadFileOutlined";
import { useColorScheme } from "@mui/material/styles";
import { useState } from "react";
import { useNavigate } from "react-router";
import { useDrive } from "~/components/DriveProvider";
import { useShellLayout } from "~/shell/layout";
import { type Command, CommandPalette, type ShortcutGroup, ShortcutsDialog, useShortcuts } from "~/shell/Shortcuts";

const GROUPS: ShortcutGroup[] = [
	{
		title: "Anywhere",
		items: [
			["/", "Search in Drive"],
			["mod+k", "Command palette"],
			["?", "Show these shortcuts"],
			["shift+r", "Refresh"],
			["[", "Collapse or expand the sidebar"],
			["v", "Switch list / grid view"],
			["i", "Show or hide details"],
		],
	},
	{
		title: "Go to",
		items: [
			["g d", "My Drive"],
			["g r", "Recent"],
			["g s", "Starred"],
			["g t", "Trash"],
		],
	},
	{
		title: "Create",
		items: [
			["alt+c", "New folder"],
			["alt+u", "Upload files"],
		],
	},
	{
		title: "Selected items",
		items: [
			["enter", "Open"],
			["f2", "Rename"],
			["s", "Star / unstar"],
			["m", "Move to…"],
			["delete", "Move to Trash"],
			["mod+a", "Select all"],
			["escape", "Clear the selection"],
		],
	},
];

/**
 * Drive-wide shortcuts, the "?" help and the Ctrl+K command palette.
 * `createTarget` is the folder new items go into (undefined where nothing can be created).
 */
export function DriveShortcuts({ createTarget, mailUrl, onSettings }: { createTarget: string | null | undefined; mailUrl?: string | null; onSettings: () => void }) {
	const d = useDrive();
	const navigate = useNavigate();
	const { setMode } = useColorScheme();
	const [help, setHelp] = useState(false);
	const [palette, setPalette] = useState(false);
	const focusSearch = () => document.querySelector<HTMLInputElement>('header [role="search"] input')?.focus();
	const toggleSidebar = () => {
		const s = useShellLayout.getState();
		s.setSidebarCollapsed(!s.sidebarCollapsed);
	};
	const toggleView = () => d.setView(d.view === "grid" ? "list" : "grid");

	useShortcuts({
		"/": focusSearch,
		"?": () => setHelp(true),
		"shift+r": d.refresh,
		"[": toggleSidebar,
		v: toggleView,
		i: () => d.setDetailsOpen(!d.detailsOpen),
		"g d": () => navigate("/"),
		"g r": () => navigate("/recent"),
		"g s": () => navigate("/starred"),
		"g t": () => navigate("/trash"),
		"mod+k": () => setPalette((p) => !p),
	});

	const commands: Command[] = [
		...(createTarget !== undefined
			? [
					{ id: "folder", group: "Create", label: "New folder", icon: <CreateNewFolderOutlinedIcon fontSize="small" />, keys: "alt+c", run: () => d.newFolder(createTarget) },
					{ id: "upload", group: "Create", label: "Upload files", icon: <UploadFileOutlinedIcon fontSize="small" />, keys: "alt+u", run: () => d.uploadFiles(createTarget) },
				]
			: []),
		{ id: "search", group: "Actions", label: "Search in Drive", icon: <SearchIcon fontSize="small" />, keys: "/", run: focusSearch },
		{ id: "refresh", group: "Actions", label: "Refresh", icon: <RefreshIcon fontSize="small" />, keys: "shift+r", run: d.refresh },
		{ id: "home", group: "Go to", label: "My Drive", icon: <HomeOutlinedIcon fontSize="small" />, keys: "g d", run: () => navigate("/") },
		{ id: "recent", group: "Go to", label: "Recent", icon: <AccessTimeIcon fontSize="small" />, keys: "g r", run: () => navigate("/recent") },
		{ id: "starred", group: "Go to", label: "Starred", icon: <StarBorderIcon fontSize="small" />, keys: "g s", run: () => navigate("/starred") },
		{ id: "trash", group: "Go to", label: "Trash", icon: <DeleteOutlineIcon fontSize="small" />, keys: "g t", run: () => navigate("/trash") },
		...(mailUrl ? [{ id: "mail", group: "Go to", label: "Mail", icon: <MailIcon fontSize="small" />, keywords: "email app", run: () => (window.location.href = mailUrl) }] : []),
		{ id: "settings", group: "Go to", label: "Settings", icon: <SettingsOutlinedIcon fontSize="small" />, keywords: "preferences", run: onSettings },
		{ id: "view", group: "View", label: d.view === "grid" ? "Switch to list view" : "Switch to grid view", icon: <GridViewIcon fontSize="small" />, keys: "v", run: toggleView },
		{ id: "details", group: "View", label: d.detailsOpen ? "Hide details" : "Show details", icon: <InfoOutlinedIcon fontSize="small" />, keys: "i", run: () => d.setDetailsOpen(!d.detailsOpen) },
		{ id: "sidebar", group: "View", label: "Collapse or expand the sidebar", icon: <MenuOpenIcon fontSize="small" />, keys: "[", run: toggleSidebar },
		{ id: "light", group: "Theme", label: "Light theme", icon: <LightModeOutlinedIcon fontSize="small" />, run: () => setMode("light") },
		{ id: "dark", group: "Theme", label: "Dark theme", icon: <DarkModeOutlinedIcon fontSize="small" />, run: () => setMode("dark") },
		{ id: "system", group: "Theme", label: "Theme follows the system", icon: <BrightnessAutoIcon fontSize="small" />, run: () => setMode("system") },
		{ id: "keys", group: "Help", label: "Keyboard shortcuts", icon: <KeyboardOutlinedIcon fontSize="small" />, keys: "?", run: () => setHelp(true) },
	];

	return (
		<>
			<ShortcutsDialog open={help} onClose={() => setHelp(false)} groups={GROUPS} />
			<CommandPalette open={palette} onClose={() => setPalette(false)} commands={commands} />
		</>
	);
}
