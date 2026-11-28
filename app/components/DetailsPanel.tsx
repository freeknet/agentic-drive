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

function Row({ label, value }: { label: string; value: React.ReactNode }) {
	return (
		<Box sx={{ mb: 2 }}>
			<Typography variant="caption" sx={{ color: "text.secondary", display: "block" }}>
				{label}
			</Typography>
			<Typography variant="body2" sx={{ wordBreak: "break-word" }}>
				{value}
			</Typography>
		</Box>
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
		<Box component="aside" aria-label="File information" sx={{ width: { xs: 1, md: 340 }, flexShrink: 0, bgcolor: "background.paper", borderRadius: { md: 4 }, p: 2.5, overflow: "auto" }}>
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
					<Row label="Type" value={style?.label} />
					{one.kind === "file" && <Row label="Size" value={`${formatBytes(one.size)} (${one.size.toLocaleString()} bytes)`} />}
					{one.mime && <Row label="Media type" value={one.mime} />}
					<Row label="Location" value={one.parent_name ?? (one.parent_id ? "Folder" : "My Drive")} />
					<Row label="Modified" value={formatDateTime(one.updated_at)} />
					<Row label="Created" value={formatDateTime(one.created_at)} />
					{one.trashed_at && <Row label="Trashed" value={formatDate(one.trashed_at)} />}
				</>
			)}
		</Box>
	);
}
