import Box from "@mui/material/Box";
import Collapse from "@mui/material/Collapse";
import IconButton from "@mui/material/IconButton";
import LinearProgress from "@mui/material/LinearProgress";
import List from "@mui/material/List";
import ListItem from "@mui/material/ListItem";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import CancelOutlinedIcon from "@mui/icons-material/CancelOutlined";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import CloseIcon from "@mui/icons-material/Close";
import ErrorIcon from "@mui/icons-material/Error";
import ExpandLessIcon from "@mui/icons-material/ExpandLess";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import { useState } from "react";
import { fileKind, formatBytes, KIND_STYLE } from "~/lib/format";
import { cancel, clearFinished, useUploads } from "~/lib/uploads";

/** Bottom-right upload tray, like Drive's. */
export function UploadPanel() {
	const uploads = useUploads();
	const [open, setOpen] = useState(true);
	if (uploads.length === 0) return null;

	const active = uploads.filter((u) => u.state === "queued" || u.state === "uploading");
	const done = uploads.filter((u) => u.state === "done").length;
	const failed = uploads.filter((u) => u.state === "error").length;
	const title = active.length
		? `Uploading ${active.length} item${active.length === 1 ? "" : "s"}`
		: failed
			? `${failed} upload${failed === 1 ? "" : "s"} failed`
			: `${done} upload${done === 1 ? "" : "s"} complete`;
	const totalBytes = active.reduce((n, u) => n + u.size, 0);
	const sentBytes = active.reduce((n, u) => n + u.sent, 0);

	return (
		<Paper elevation={6} sx={{ position: "fixed", right: { xs: 8, sm: 24 }, bottom: 0, width: "min(360px, calc(100vw - 16px))", borderRadius: "16px 16px 0 0", overflow: "hidden", zIndex: (t) => t.zIndex.snackbar - 1 }}>
			<Stack direction="row" sx={{ alignItems: "center", pl: 2.5, pr: 1, py: 1, bgcolor: "background.default" }}>
				<Typography role="status" sx={{ flex: 1, fontWeight: 500 }}>
					{title}
				</Typography>
				<IconButton aria-label={open ? "Collapse uploads" : "Expand uploads"} onClick={() => setOpen(!open)}>
					{open ? <ExpandMoreIcon /> : <ExpandLessIcon />}
				</IconButton>
				{!active.length && (
					<IconButton aria-label="Close uploads" onClick={clearFinished}>
						<CloseIcon />
					</IconButton>
				)}
			</Stack>
			{active.length > 0 && (
				<Box sx={{ px: 2.5, py: 0.75, bgcolor: "action.hover" }}>
					<Typography variant="caption" sx={{ color: "text.secondary" }}>
						{formatBytes(sentBytes)} of {formatBytes(totalBytes)}
					</Typography>
				</Box>
			)}
			<Collapse in={open}>
				<List dense sx={{ maxHeight: 280, overflow: "auto" }}>
					{uploads.map((u) => {
						const { icon: Icon, color } = KIND_STYLE[fileKind({ kind: "file", mime: null, name: u.name })];
						const pct = u.size ? (u.sent / u.size) * 100 : 100;
						return (
							<ListItem
								key={u.key}
								secondaryAction={
									u.state === "done" ? (
										<CheckCircleIcon sx={{ color: "success.main" }} />
									) : u.state === "error" ? (
										<Tooltip title={u.error ?? "Failed"}>
											<ErrorIcon sx={{ color: "error.main" }} />
										</Tooltip>
									) : u.state === "cancelled" ? (
										<Typography variant="caption" sx={{ color: "text.secondary" }}>
											Cancelled
										</Typography>
									) : (
										<IconButton edge="end" aria-label={`Cancel ${u.name}`} onClick={() => cancel(u.key)}>
											<CancelOutlinedIcon />
										</IconButton>
									)
								}
							>
								<Stack direction="row" spacing={1.5} sx={{ alignItems: "center", minWidth: 0, flex: 1, pr: 1 }}>
									<Icon sx={{ color, fontSize: 20 }} />
									<Box sx={{ minWidth: 0, flex: 1 }}>
										<Typography variant="body2" noWrap title={u.name}>
											{u.name}
										</Typography>
										{u.state === "uploading" && <LinearProgress variant="determinate" value={pct} sx={{ mt: 0.5, borderRadius: 1 }} />}
										{u.state === "queued" && (
											<Typography variant="caption" sx={{ color: "text.secondary" }}>
												Waiting…
											</Typography>
										)}
										{u.state === "error" && (
											<Typography variant="caption" sx={{ color: "error.main" }}>
												{u.error}
											</Typography>
										)}
									</Box>
								</Stack>
							</ListItem>
						);
					})}
				</List>
			</Collapse>
		</Paper>
	);
}
