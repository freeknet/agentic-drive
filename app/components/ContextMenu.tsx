import Divider from "@mui/material/Divider";
import ListItemIcon from "@mui/material/ListItemIcon";
import ListItemText from "@mui/material/ListItemText";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import Typography from "@mui/material/Typography";
import CreateNewFolderOutlinedIcon from "@mui/icons-material/CreateNewFolderOutlined";
import DeleteForeverOutlinedIcon from "@mui/icons-material/DeleteForeverOutlined";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutlineOutlined";
import DownloadOutlinedIcon from "@mui/icons-material/DownloadOutlined";
import DriveFileMoveOutlinedIcon from "@mui/icons-material/DriveFileMoveOutlined";
import DriveFileRenameOutlineIcon from "@mui/icons-material/DriveFileRenameOutline";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import LinkIcon from "@mui/icons-material/Link";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import PersonAddAltOutlinedIcon from "@mui/icons-material/PersonAddAltOutlined";
import RestoreIcon from "@mui/icons-material/Restore";
import StarBorderIcon from "@mui/icons-material/StarBorder";
import StarOutlineIcon from "@mui/icons-material/Star";
import UploadFileOutlinedIcon from "@mui/icons-material/UploadFileOutlined";
import VisibilityOutlinedIcon from "@mui/icons-material/VisibilityOutlined";
import type { ReactNode } from "react";
import type { Item } from "~/lib/api";
import { useDrive } from "./DriveProvider";

export type MenuTarget =
	| { kind: "items"; items: Item[]; siblings: Item[]; trash?: boolean }
	| { kind: "background"; parentId: string | null };

function Entry({ icon, label, hint, onClick, danger }: { icon: ReactNode; label: string; hint?: string; onClick: () => void; danger?: boolean }) {
	return (
		<MenuItem onClick={onClick} sx={danger ? { color: "error.main" } : undefined}>
			<ListItemIcon sx={danger ? { color: "error.main" } : undefined}>{icon}</ListItemIcon>
			<ListItemText>{label}</ListItemText>
			{hint && (
				<Typography variant="body2" sx={{ color: "text.secondary", ml: 3 }}>
					{hint}
				</Typography>
			)}
		</MenuItem>
	);
}

/** Right-click menu, positioned at the pointer. */
export function ContextMenu({ x, y, target, onClose }: { x: number; y: number; target: MenuTarget; onClose: () => void }) {
	const d = useDrive();
	const run = (fn: () => unknown) => () => {
		onClose();
		void fn();
	};

	let entries: ReactNode[] = [];
	if (target.kind === "background") {
		entries = [
			<Entry key="folder" icon={<CreateNewFolderOutlinedIcon fontSize="small" />} label="New folder" hint="Alt+C" onClick={run(() => d.newFolder(target.parentId))} />,
			<Entry key="upload" icon={<UploadFileOutlinedIcon fontSize="small" />} label="File upload" hint="Alt+U" onClick={run(() => d.uploadFiles(target.parentId))} />,
		];
	} else if (target.trash) {
		const { items } = target;
		entries = [
			<Entry key="restore" icon={<RestoreIcon fontSize="small" />} label="Restore" onClick={run(() => d.restore(items))} />,
			<Entry key="purge" icon={<DeleteForeverOutlinedIcon fontSize="small" />} label="Delete forever" danger onClick={run(() => d.purge(items))} />,
		];
	} else {
		const { items, siblings } = target;
		const one = items.length === 1 ? items[0] : null;
		const allStarred = items.every((i) => i.starred);
		const hasFiles = items.some((i) => i.kind === "file");
		entries = [
			one &&
				(one.kind === "folder" ? (
					<Entry key="open" icon={<OpenInNewIcon fontSize="small" />} label="Open" hint="Enter" onClick={run(() => d.open(one))} />
				) : (
					<Entry key="preview" icon={<VisibilityOutlinedIcon fontSize="small" />} label="Preview" hint="Enter" onClick={run(() => d.preview(one, siblings))} />
				)),
			hasFiles && <Entry key="download" icon={<DownloadOutlinedIcon fontSize="small" />} label="Download" onClick={run(() => d.download(items))} />,
			one && <Entry key="rename" icon={<DriveFileRenameOutlineIcon fontSize="small" />} label="Rename" hint="F2" onClick={run(() => d.rename(one))} />,
			one?.kind === "file" && <Divider key="d1" />,
			one?.kind === "file" && <Entry key="link" icon={<LinkIcon fontSize="small" />} label="Copy link" onClick={run(() => d.copyLink(one))} />,
			one?.kind === "file" && <Entry key="share" icon={<PersonAddAltOutlinedIcon fontSize="small" />} label="Share" onClick={run(() => d.share(one))} />,
			<Divider key="d2" />,
			<Entry key="move" icon={<DriveFileMoveOutlinedIcon fontSize="small" />} label="Move" onClick={run(() => d.move(items))} />,
			<Entry
				key="star"
				icon={allStarred ? <StarOutlineIcon fontSize="small" /> : <StarBorderIcon fontSize="small" />}
				label={allStarred ? "Remove from Starred" : "Add to Starred"}
				onClick={run(() => d.star(items, !allStarred))}
			/>,
			one && (
				<Entry
					key="details"
					icon={<InfoOutlinedIcon fontSize="small" />}
					label="File information"
					onClick={run(() => {
						d.setSelected(new Set([one.id]));
						d.setDetailsOpen(true);
					})}
				/>
			),
			<Divider key="d3" />,
			<Entry key="trash" icon={<DeleteOutlineIcon fontSize="small" />} label="Move to trash" hint="Delete" onClick={run(() => d.trash(items))} />,
		].filter(Boolean);
	}

	return (
		<Menu
			open
			onClose={onClose}
			anchorReference="anchorPosition"
			anchorPosition={{ top: y, left: x }}
			onContextMenu={(e) => {
				// A second right-click closes the menu instead of opening the browser's.
				e.preventDefault();
				onClose();
			}}
			slotProps={{ paper: { sx: { minWidth: 260 } }, list: { dense: true } }}
		>
			{entries}
		</Menu>
	);
}
