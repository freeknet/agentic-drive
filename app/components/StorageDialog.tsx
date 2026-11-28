import CloseIcon from "@mui/icons-material/Close";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutlineOutlined";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import IconButton from "@mui/material/IconButton";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import { useNavigate } from "react-router";
import type { Stats } from "~/lib/api";
import { type FileKind, fileKind, formatBytes, KIND_STYLE } from "~/lib/format";

/**
 * Where the space goes: one bar split by file type in each type's colour,
 * then a legend with sizes and counts, and what the trash is holding.
 */
export function StorageDialog({ open, onClose, stats }: { open: boolean; onClose: () => void; stats: Stats }) {
	const navigate = useNavigate();
	const groups = new Map<FileKind, { bytes: number; files: number }>();
	for (const m of stats.byMime ?? []) {
		const kind = fileKind({ kind: "file", mime: m.mime, name: m.name });
		const g = groups.get(kind) ?? { bytes: 0, files: 0 };
		g.bytes += m.bytes;
		g.files += m.files;
		groups.set(kind, g);
	}
	const rows = [...groups.entries()].sort((a, b) => b[1].bytes - a[1].bytes);
	const used = rows.reduce((n, [, g]) => n + g.bytes, 0);
	// The coloured bar splits what you store (files plus trash), so small amounts still show.
	const whole = used + stats.trashBytes;
	const pct = (n: number) => (whole ? (n / whole) * 100 : 0);
	const usedPct = stats.limit ? Math.min(100, (stats.bytes / stats.limit) * 100) : 0;

	return (
		<Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
			<DialogTitle sx={{ pr: 6 }}>
				Storage
				<IconButton aria-label="Close" onClick={onClose} sx={{ position: "absolute", right: 12, top: 12 }}>
					<CloseIcon />
				</IconButton>
			</DialogTitle>
			<DialogContent>
				<Typography variant="h4" sx={{ fontWeight: 400 }}>
					{formatBytes(stats.bytes)}
					<Typography component="span" variant="body1" color="text.secondary" sx={{ ml: 1 }}>
						of {formatBytes(stats.limit)} used
					</Typography>
				</Typography>
				{/* Overall use of the allowance… */}
				<Box sx={{ height: 4, borderRadius: 1, bgcolor: "action.hover", mt: 1.5, overflow: "hidden" }}>
					<Box sx={{ width: `${Math.max(usedPct, 0.5)}%`, height: 1, bgcolor: "primary.main" }} />
				</Box>
				{/* …and what that space is made of. */}
				<Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 2.5, mb: 0.75 }}>
					By type
				</Typography>
				<Box role="img" aria-label="Storage used by type" sx={{ display: "flex", height: 14, borderRadius: 2, overflow: "hidden", bgcolor: "action.hover", mb: 2 }}>
					{rows.map(([kind, g]) => (
						<Tooltip key={kind} title={`${KIND_STYLE[kind].label}: ${formatBytes(g.bytes)}`}>
							<Box sx={{ width: `${Math.max(pct(g.bytes), g.bytes ? 0.6 : 0)}%`, bgcolor: KIND_STYLE[kind].color, "&:not(:last-of-type)": { borderRight: "2px solid var(--mui-palette-background-paper)" } }} />
						</Tooltip>
					))}
					{stats.trashBytes > 0 && (
						<Tooltip title={`Trash: ${formatBytes(stats.trashBytes)}`}>
							<Box sx={{ width: `${Math.max(pct(stats.trashBytes), 0.6)}%`, backgroundImage: "repeating-linear-gradient(45deg, #9aa0a6 0 4px, transparent 4px 8px)" }} />
						</Tooltip>
					)}
				</Box>
				<Box component="ul" sx={{ listStyle: "none", p: 0, m: 0 }}>
					{rows.map(([kind, g]) => {
						const { icon: Icon, color, label } = KIND_STYLE[kind];
						return (
							<Box component="li" key={kind} sx={{ display: "flex", alignItems: "center", gap: 1.5, py: 1, borderBottom: 1, borderColor: "divider" }}>
								<Box sx={{ width: 36, height: 36, borderRadius: 2, display: "flex", alignItems: "center", justifyContent: "center", color, bgcolor: `color-mix(in srgb, ${color} 14%, transparent)` }}>
									<Icon fontSize="small" />
								</Box>
								<Box sx={{ flex: 1, minWidth: 0 }}>
									<Typography variant="body2" sx={{ fontWeight: 500 }}>
										{label}
									</Typography>
									<Typography variant="caption" color="text.secondary">
										{g.files} file{g.files === 1 ? "" : "s"}
									</Typography>
								</Box>
								<Typography variant="body2" sx={{ fontWeight: 600 }}>
									{formatBytes(g.bytes)}
								</Typography>
								<Typography variant="caption" color="text.secondary" sx={{ width: 44, textAlign: "right" }}>
									{used ? Math.round((g.bytes / used) * 100) : 0}%
								</Typography>
							</Box>
						);
					})}
					{rows.length === 0 && (
						<Typography variant="body2" color="text.secondary" sx={{ py: 2 }}>
							No files yet.
						</Typography>
					)}
				</Box>
				{stats.trashBytes > 0 && (
					<Box sx={{ display: "flex", alignItems: "center", gap: 1.5, mt: 2, p: 1.5, borderRadius: 2, bgcolor: "action.hover" }}>
						<DeleteOutlineIcon sx={{ color: "#ea4335" }} />
						<Typography variant="body2" sx={{ flex: 1 }}>
							The trash holds {formatBytes(stats.trashBytes)}. It still counts until it's emptied.
						</Typography>
						<Button
							size="small"
							onClick={() => {
								onClose();
								navigate("/trash");
							}}
						>
							Open trash
						</Button>
					</Box>
				)}
			</DialogContent>
		</Dialog>
	);
}
