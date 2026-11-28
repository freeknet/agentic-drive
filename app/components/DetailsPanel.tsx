import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Divider from "@mui/material/Divider";
import IconButton from "@mui/material/IconButton";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import CloseIcon from "@mui/icons-material/Close";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import LinkIcon from "@mui/icons-material/Link";
import { useQuery } from "@tanstack/react-query";
import { api, contentUrl, type Item } from "~/lib/api";
import { fileKind, formatBytes, formatDate, formatDateTime, KIND_STYLE } from "~/lib/format";
import { useDrive } from "./DriveProvider";
import { Thumbnail } from "~/components/Thumbnail";
import Tooltip from "@mui/material/Tooltip";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import DownloadIcon from "@mui/icons-material/Download";
import PersonAddAltOutlinedIcon from "@mui/icons-material/PersonAddAltOutlined";
import StarIcon from "@mui/icons-material/Star";
import StarBorderIcon from "@mui/icons-material/StarBorder";
import DataUsageIcon from "@mui/icons-material/DataUsage";
import CodeIcon from "@mui/icons-material/Code";
import FolderOpenOutlinedIcon from "@mui/icons-material/FolderOpenOutlined";
import EditCalendarOutlinedIcon from "@mui/icons-material/EditCalendarOutlined";
import EventAvailableOutlinedIcon from "@mui/icons-material/EventAvailableOutlined";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutlineOutlined";
import { rainbowFor } from "~/theme";

/** One detail: a small coloured icon tile, then the label over the value. */
function Row({ label, value, icon, color }: { label: string; value: React.ReactNode; icon: React.ReactNode; color: string }) {
	return (
		<Box sx={{ display: "flex", gap: 1.5, mb: 1.75, alignItems: "flex-start" }}>
			<Box sx={{ width: 32, height: 32, borderRadius: 2, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", color, bgcolor: `color-mix(in srgb, ${color} 14%, transparent)`, "& svg": { fontSize: 18 } }}>
				{icon}
			</Box>
			<Box sx={{ minWidth: 0 }}>
				<Typography variant="caption" sx={{ color: "text.secondary", display: "block" }}>
					{label}
				</Typography>
				<Typography variant="body2" sx={{ wordBreak: "break-word" }}>
					{value}
				</Typography>
			</Box>
		</Box>
	);
}

/** A round tonal action button with its label underneath (M3 style). */
function QuickAction({ label, icon, color, onClick }: { label: string; icon: React.ReactNode; color: string; onClick: () => void }) {
	return (
		<Stack spacing={0.5} sx={{ alignItems: "center", flex: 1, minWidth: 0 }}>
			<Tooltip title={label}>
				<IconButton aria-label={label} onClick={onClick} sx={{ width: 44, height: 44, color, bgcolor: `color-mix(in srgb, ${color} 14%, transparent)`, "&:hover": { bgcolor: `color-mix(in srgb, ${color} 24%, transparent)` } }}>
					{icon}
				</IconButton>
			</Tooltip>
			<Typography variant="caption" color="text.secondary" noWrap>
				{label}
			</Typography>
		</Stack>
	);
}

/** Right-hand "File information" panel for the selected item. */
export function DetailsPanel({ items }: { items: Item[] }) {
	const d = useDrive();
	const one = items.length === 1 ? items[0] : null;
	const { data: shares } = useQuery({
		queryKey: ["shares", one?.id],
		queryFn: () => api.shares(one!.id),
		enabled: !!one && one.kind === "file" && !one.trashed_at,
	});
	const style = one ? KIND_STYLE[fileKind(one)] : null;

	return (
		<Box component="aside" aria-label="File information" sx={{ width: { xs: 1, md: 340 }, flexShrink: 0, bgcolor: "background.paper", borderRadius: { md: 3 }, p: 2.5, overflow: "auto" }}>
			<Stack direction="row" spacing={1} sx={{ alignItems: "center", mb: 2 }}>
				{style && one ? <style.icon sx={{ color: style.color }} /> : <InfoOutlinedIcon sx={{ color: "text.secondary" }} />}
				<Typography noWrap sx={{ flex: 1, fontWeight: 500 }} title={one?.name}>
					{one ? one.name : items.length ? `${items.length} items selected` : "File information"}
				</Typography>
				<IconButton aria-label="Close file information" onClick={() => d.setDetailsOpen(false)}>
					<CloseIcon />
				</IconButton>
			</Stack>
			{!one ? (
				<Stack sx={{ alignItems: "center", textAlign: "center", py: 6, color: "text.secondary" }} spacing={1}>
					<InfoOutlinedIcon sx={{ fontSize: 56, opacity: 0.5 }} />
					<Typography variant="body2">{items.length ? "Select one item to see its details" : "Select a file or folder to see its details"}</Typography>
				</Stack>
			) : (
				<>
					<Box sx={{ aspectRatio: "16 / 10", borderRadius: 3, bgcolor: "action.hover", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden", mb: 2 }}>
						<Thumbnail key={one.id} item={one} fit="contain" fallback={style && <style.icon sx={{ fontSize: 72, color: style.color }} />} />
					</Box>
					{!one.trashed_at && (
						<Stack direction="row" sx={{ mb: 2.5 }}>
							<QuickAction label="Open" icon={<OpenInNewIcon />} color="#4285f4" onClick={() => d.open(one, items.length ? items : [one])} />
							{one.kind === "file" && <QuickAction label="Download" icon={<DownloadIcon />} color="#34a853" onClick={() => d.download([one])} />}
							{one.kind === "file" && <QuickAction label="Share" icon={<PersonAddAltOutlinedIcon />} color="#a142f4" onClick={() => d.share(one)} />}
							<QuickAction label={one.starred ? "Unstar" : "Star"} icon={one.starred ? <StarIcon /> : <StarBorderIcon />} color="#f4b400" onClick={() => void d.star([one], !one.starred)} />
						</Stack>
					)}
					{one.kind === "file" && !one.trashed_at && (
						<>
							<Typography variant="subtitle2" sx={{ mb: 1 }}>
								Who has access
							</Typography>
							<Stack direction="row" spacing={1} sx={{ alignItems: "center", mb: 1 }}>
								<LinkIcon fontSize="small" sx={{ color: "text.secondary" }} />
								<Typography variant="body2" sx={{ flex: 1 }}>
									{shares?.shares.length
										? `${shares.shares.length} active link${shares.shares.length === 1 ? "" : "s"} · anyone with a link can download`
										: "Only you"}
								</Typography>
							</Stack>
							<Button size="small" variant="outlined" onClick={() => d.share(one)} sx={{ mb: 2 }}>
								Manage access
							</Button>
							<Divider sx={{ mb: 2 }} />
						</>
					)}
					<Typography variant="subtitle2" sx={{ mb: 1.5 }}>
						File details
					</Typography>
					<Row label="Type" value={style?.label} icon={style ? <style.icon /> : <InfoOutlinedIcon />} color={style?.color ?? "#5f6368"} />
					{one.kind === "file" && <Row label="Size" value={`${formatBytes(one.size)} (${one.size.toLocaleString()} bytes)`} icon={<DataUsageIcon />} color="#24c1e0" />}
					{one.mime && <Row label="Media type" value={one.mime} icon={<CodeIcon />} color="#5f6368" />}
					<Row label="Location" value={one.parent_name ?? (one.parent_id ? "Folder" : "My Drive")} icon={<FolderOpenOutlinedIcon />} color={one.parent_id ? rainbowFor(one.parent_id) : "#4285f4"} />
					<Row label="Modified" value={formatDateTime(one.updated_at)} icon={<EditCalendarOutlinedIcon />} color="#fa7b17" />
					<Row label="Created" value={formatDateTime(one.created_at)} icon={<EventAvailableOutlinedIcon />} color="#34a853" />
					{one.trashed_at && <Row label="Trashed" value={formatDate(one.trashed_at)} icon={<DeleteOutlineIcon />} color="#ea4335" />}
				</>
			)}
		</Box>
	);
}
