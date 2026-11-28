import Box from "@mui/material/Box";
import Breadcrumbs from "@mui/material/Breadcrumbs";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogContentText from "@mui/material/DialogContentText";
import DialogTitle from "@mui/material/DialogTitle";
import FormControl from "@mui/material/FormControl";
import IconButton from "@mui/material/IconButton";
import InputLabel from "@mui/material/InputLabel";
import Link from "@mui/material/Link";
import List from "@mui/material/List";
import ListItemButton from "@mui/material/ListItemButton";
import ListItemIcon from "@mui/material/ListItemIcon";
import ListItemText from "@mui/material/ListItemText";
import MenuItem from "@mui/material/MenuItem";
import Paper from "@mui/material/Paper";
import Select from "@mui/material/Select";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import CloseIcon from "@mui/icons-material/Close";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import DownloadOutlinedIcon from "@mui/icons-material/DownloadOutlined";
import FolderIcon from "@mui/icons-material/Folder";
import LinkIcon from "@mui/icons-material/Link";
import LinkOffIcon from "@mui/icons-material/LinkOff";
import PersonAddAltOutlinedIcon from "@mui/icons-material/PersonAddAltOutlined";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { api, ApiError, contentUrl, type Item } from "~/lib/api";
import { fileKind, formatBytes, formatDate, KIND_STYLE, previewKind } from "~/lib/format";

const message = (e: unknown) => (e instanceof ApiError ? e.message : "Something went wrong");

// ── name (new folder / rename) ─────────────────────────────────────

export function NameDialog(props: {
	title: string;
	initial: string;
	placeholder?: string;
	submitLabel: string;
	selectStem?: boolean;
	onClose: () => void;
	onSubmit: (name: string) => Promise<void>;
}) {
	const [name, setName] = useState(props.initial);
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const selected = useRef(false);

	const submit = async (e: React.FormEvent) => {
		e.preventDefault();
		const value = name.trim() || props.placeholder || "";
		if (!value) return setError("Enter a name");
		setBusy(true);
		try {
			await props.onSubmit(value);
			props.onClose();
		} catch (err) {
			setError(message(err));
			setBusy(false);
		}
	};

	return (
		<Dialog open onClose={props.onClose} maxWidth="xs" fullWidth slotProps={{ paper: { component: "form", onSubmit: submit } as object }}>
			<DialogTitle>{props.title}</DialogTitle>
			<DialogContent>
				<TextField
					autoFocus
					fullWidth
					margin="dense"
					value={name}
					placeholder={props.placeholder}
					error={!!error}
					helperText={error ?? " "}
					onChange={(e) => setName(e.target.value)}
					onFocus={(e) => {
						if (selected.current) return;
						selected.current = true;
						const dot = props.selectStem ? props.initial.lastIndexOf(".") : -1;
						(e.target as HTMLInputElement).setSelectionRange(0, dot > 0 ? dot : props.initial.length);
					}}
					slotProps={{ htmlInput: { "aria-label": "Name" } }}
				/>
			</DialogContent>
			<DialogActions sx={{ px: 3, pb: 2 }}>
				<Button onClick={props.onClose}>Cancel</Button>
				<Button type="submit" loading={busy}>
					{props.submitLabel}
				</Button>
			</DialogActions>
		</Dialog>
	);
}

// ── confirm ────────────────────────────────────────────────────────

export function ConfirmDialog(props: { title: string; body: string; confirmLabel: string; onClose: () => void; onConfirm: () => Promise<void> }) {
	const [busy, setBusy] = useState(false);
	return (
		<Dialog open onClose={props.onClose} maxWidth="xs" fullWidth>
			<DialogTitle>{props.title}</DialogTitle>
			<DialogContent>
				<DialogContentText>{props.body}</DialogContentText>
			</DialogContent>
			<DialogActions sx={{ px: 3, pb: 2 }}>
				<Button onClick={props.onClose}>Cancel</Button>
				<Button
					color="error"
					loading={busy}
					onClick={async () => {
						setBusy(true);
						await props.onConfirm();
						props.onClose();
					}}
				>
					{props.confirmLabel}
				</Button>
			</DialogActions>
		</Dialog>
	);
}

// ── move ───────────────────────────────────────────────────────────

export function MoveDialog({ items, onClose, onMove }: { items: Item[]; onClose: () => void; onMove: (parentId: string | null) => Promise<void> }) {
	const start = items.length === 1 ? items[0].parent_id : null;
	const [at, setAt] = useState<string | null>(start);
	const [busy, setBusy] = useState(false);
	const moving = new Set(items.map((i) => i.id));
	// Its own cache key: the folder view stores a different shape under ["files", id],
	// and React Query treats undefined (My Drive in the view) and null alike.
	const { data, isLoading } = useQuery({ queryKey: ["move-picker", at], queryFn: () => api.list(at) });
	const folders = (data?.items ?? []).filter((i) => i.kind === "folder" && !moving.has(i.id));
	const sameFolder = items.every((i) => i.parent_id === at);
	const title = items.length === 1 ? `Move "${items[0].name}"` : `Move ${items.length} items`;

	return (
		<Dialog open onClose={onClose} maxWidth="sm" fullWidth>
			<DialogTitle sx={{ pb: 1 }}>{title}</DialogTitle>
			<DialogContent>
				<Stack direction="row" spacing={1} sx={{ alignItems: "center", mb: 1, minHeight: 40 }}>
					{at && (
						<IconButton size="small" aria-label="Up one folder" onClick={() => setAt(data?.breadcrumbs.at(-2)?.id ?? null)}>
							<ArrowBackIcon fontSize="small" />
						</IconButton>
					)}
					<Breadcrumbs maxItems={4} aria-label="Folder path">
						<Link component="button" underline="hover" color="inherit" onClick={() => setAt(null)}>
							My Drive
						</Link>
						{data?.breadcrumbs.map((b) => (
							<Link key={b.id} component="button" underline="hover" color="inherit" onClick={() => setAt(b.id)}>
								{b.name}
							</Link>
						))}
					</Breadcrumbs>
				</Stack>
				<Paper variant="outlined" sx={{ height: 300, overflow: "auto" }}>
					{isLoading ? (
						<Stack sx={{ height: 1, alignItems: "center", justifyContent: "center" }}>
							<CircularProgress size={28} />
						</Stack>
					) : folders.length === 0 ? (
						<Typography sx={{ p: 2, color: "text.secondary" }}>No folders here. You can move into this folder.</Typography>
					) : (
						<List dense>
							{folders.map((f) => (
								<ListItemButton key={f.id} onClick={() => setAt(f.id)} sx={{ mx: 1 }}>
									<ListItemIcon sx={{ minWidth: 36 }}>
										<FolderIcon sx={{ color: KIND_STYLE.folder.color }} />
									</ListItemIcon>
									<ListItemText primary={f.name} />
									<ChevronRightIcon sx={{ color: "text.secondary" }} />
								</ListItemButton>
							))}
						</List>
					)}
				</Paper>
			</DialogContent>
			<DialogActions sx={{ px: 3, pb: 2 }}>
				<Button onClick={onClose}>Cancel</Button>
				<Button
					variant="contained"
					loading={busy}
					disabled={sameFolder}
					onClick={async () => {
						setBusy(true);
						await onMove(at);
						onClose();
					}}
				>
					Move here
				</Button>
			</DialogActions>
		</Dialog>
	);
}

// ── share ──────────────────────────────────────────────────────────

export function ShareDialog({ item, onClose, notify }: { item: Item; onClose: () => void; notify: (m: string, o?: { severity?: "error" }) => void }) {
	const qc = useQueryClient();
	const [expiry, setExpiry] = useState("30");
	const [busy, setBusy] = useState(false);
	const { data } = useQuery({ queryKey: ["shares", item.id], queryFn: () => api.shares(item.id) });
	const shares = data?.shares ?? [];

	const copy = async (url: string) => {
		try {
			await navigator.clipboard.writeText(url);
			notify("Link copied");
		} catch {
			notify("Couldn't copy; select the link and copy it", { severity: "error" });
		}
	};

	return (
		<Dialog open onClose={onClose} maxWidth="sm" fullWidth>
			<DialogTitle>Share "{item.name}"</DialogTitle>
			<DialogContent>
				<Stack direction="row" spacing={2} sx={{ alignItems: "center", mb: 1 }}>
					<PersonAddAltOutlinedIcon sx={{ color: "text.secondary" }} />
					<Typography variant="body2" sx={{ color: "text.secondary" }}>
						Anyone with the link can download this file. No sign-in needed.
					</Typography>
				</Stack>
				<Stack direction={{ xs: "column", sm: "row" }} spacing={2} sx={{ mt: 2, alignItems: { sm: "center" } }}>
					<FormControl size="small" sx={{ minWidth: 180 }}>
						<InputLabel id="expiry-label">Link expires after</InputLabel>
						<Select labelId="expiry-label" label="Link expires after" value={expiry} onChange={(e) => setExpiry(e.target.value)}>
							<MenuItem value="7">7 days</MenuItem>
							<MenuItem value="30">30 days</MenuItem>
							<MenuItem value="365">1 year</MenuItem>
							<MenuItem value="never">Never</MenuItem>
						</Select>
					</FormControl>
					<Button
						variant="contained"
						startIcon={<LinkIcon />}
						loading={busy}
						onClick={async () => {
							setBusy(true);
							try {
								const s = await api.share(item.id, expiry === "never" ? null : Number(expiry));
								await qc.invalidateQueries({ queryKey: ["shares", item.id] });
								await copy(s.url);
							} catch (e) {
								notify(message(e), { severity: "error" });
							} finally {
								setBusy(false);
							}
						}}
					>
						Create and copy link
					</Button>
				</Stack>
				{shares.length > 0 && (
					<Box sx={{ mt: 3 }}>
						<Typography variant="subtitle2" sx={{ mb: 1 }}>
							Active links
						</Typography>
						<Stack spacing={1}>
							{shares.map((s) => (
								<Paper key={s.token} variant="outlined" sx={{ p: 1, pl: 2, display: "flex", alignItems: "center", gap: 1 }}>
									<Box sx={{ minWidth: 0, flex: 1 }}>
										<Typography variant="body2" noWrap title={s.url}>
											{s.url}
										</Typography>
										<Typography variant="caption" sx={{ color: "text.secondary" }}>
											{s.expires_at ? `Expires ${formatDate(s.expires_at)}` : "Never expires"} · {s.downloads} download{s.downloads === 1 ? "" : "s"}
										</Typography>
									</Box>
									<Tooltip title="Copy link">
										<IconButton aria-label="Copy link" onClick={() => copy(s.url)}>
											<ContentCopyIcon fontSize="small" />
										</IconButton>
									</Tooltip>
									<Tooltip title="Turn off link">
										<IconButton
											aria-label="Turn off link"
											onClick={async () => {
												await api.revokeShare(s.token);
												await qc.invalidateQueries({ queryKey: ["shares", item.id] });
												notify("Link turned off");
											}}
										>
											<LinkOffIcon fontSize="small" />
										</IconButton>
									</Tooltip>
								</Paper>
							))}
						</Stack>
					</Box>
				)}
			</DialogContent>
			<DialogActions sx={{ px: 3, pb: 2 }}>
				<Button variant="contained" onClick={onClose}>
					Done
				</Button>
			</DialogActions>
		</Dialog>
	);
}

// ── preview ────────────────────────────────────────────────────────

function TextPreview({ id }: { id: string }) {
	const { data, isLoading } = useQuery({ queryKey: ["text", id], queryFn: () => fetch(contentUrl(id)).then((r) => r.text()) });
	if (isLoading) return <CircularProgress />;
	return (
		<Paper sx={{ width: "min(900px, 100%)", maxHeight: 1, overflow: "auto", p: 3 }}>
			<Box component="pre" sx={{ m: 0, whiteSpace: "pre-wrap", wordBreak: "break-word", fontFamily: "ui-monospace, Consolas, monospace", fontSize: 13 }}>
				{data}
			</Box>
		</Paper>
	);
}

/** Full-screen viewer over a dark backdrop; arrow keys move between files. */
export function PreviewDialog(props: { item: Item; siblings: Item[]; onNavigate: (item: Item) => void; onClose: () => void; onShare: (item: Item) => void }) {
	const { item } = props;
	const files = props.siblings.filter((s) => s.kind === "file");
	const index = files.findIndex((f) => f.id === item.id);
	const prev = index > 0 ? files[index - 1] : null;
	const next = index >= 0 && index < files.length - 1 ? files[index + 1] : null;
	const kind = previewKind(item);
	const src = contentUrl(item.id);
	const { icon: Icon, color } = KIND_STYLE[fileKind(item)];

	useEffect(() => {
		const onKey = (e: KeyboardEvent) => {
			if (e.key === "ArrowLeft" && prev) props.onNavigate(prev);
			if (e.key === "ArrowRight" && next) props.onNavigate(next);
		};
		window.addEventListener("keydown", onKey);
		return () => window.removeEventListener("keydown", onKey);
	}, [prev, next, props]);

	const light = { color: "#fff" };
	return (
		<Dialog open fullScreen onClose={props.onClose} slotProps={{ paper: { sx: { bgcolor: "rgba(10,10,10,0.94)", backdropFilter: "blur(6px)", borderRadius: 0 } } }}>
			<Stack direction="row" spacing={1} sx={{ alignItems: "center", px: 2, py: 1, color: "#fff" }}>
				<IconButton aria-label="Close" onClick={props.onClose} sx={light}>
					<ArrowBackIcon />
				</IconButton>
				<Icon sx={{ color }} />
				<Typography noWrap sx={{ flex: 1, fontWeight: 500 }}>
					{item.name}
				</Typography>
				<Typography variant="body2" sx={{ opacity: 0.7, display: { xs: "none", sm: "block" } }}>
					{formatBytes(item.size)}
				</Typography>
				<Tooltip title="Share">
					<IconButton aria-label="Share" onClick={() => props.onShare(item)} sx={light}>
						<PersonAddAltOutlinedIcon />
					</IconButton>
				</Tooltip>
				<Tooltip title="Download">
					<IconButton aria-label="Download" href={contentUrl(item.id, true)} sx={light}>
						<DownloadOutlinedIcon />
					</IconButton>
				</Tooltip>
				<IconButton aria-label="Close preview" onClick={props.onClose} sx={light}>
					<CloseIcon />
				</IconButton>
			</Stack>
			<Box sx={{ position: "relative", flex: 1, minHeight: 0, display: "flex", alignItems: "center", justifyContent: "center", p: { xs: 1, sm: 4 } }}>
				{kind === "image" && <Box component="img" src={src} alt={item.name} sx={{ maxWidth: 1, maxHeight: 1, objectFit: "contain" }} />}
				{kind === "video" && <Box component="video" key={item.id} src={src} controls autoPlay sx={{ maxWidth: 1, maxHeight: 1 }} />}
				{kind === "audio" && <audio key={item.id} src={src} controls autoPlay />}
				{kind === "pdf" && <Box component="iframe" key={item.id} src={src} title={item.name} sx={{ width: "min(1000px, 100%)", height: 1, border: 0, bgcolor: "#fff", borderRadius: 1 }} />}
				{kind === "text" && <TextPreview id={item.id} />}
				{kind === null && (
					<Paper sx={{ p: 4, textAlign: "center", maxWidth: 360 }}>
						<Icon sx={{ fontSize: 56, color, mb: 1 }} />
						<Typography sx={{ mb: 2 }}>No preview available</Typography>
						<Button variant="contained" startIcon={<DownloadOutlinedIcon />} href={contentUrl(item.id, true)}>
							Download
						</Button>
					</Paper>
				)}
				{prev && (
					<IconButton
						aria-label="Previous file"
						onClick={() => props.onNavigate(prev)}
						sx={{ position: "absolute", left: 16, top: "50%", transform: "translateY(-50%)", bgcolor: "rgba(255,255,255,0.12)", color: "#fff", "&:hover": { bgcolor: "rgba(255,255,255,0.24)" } }}
					>
						<ChevronLeftIcon fontSize="large" />
					</IconButton>
				)}
				{next && (
					<IconButton
						aria-label="Next file"
						onClick={() => props.onNavigate(next)}
						sx={{ position: "absolute", right: 16, top: "50%", transform: "translateY(-50%)", bgcolor: "rgba(255,255,255,0.12)", color: "#fff", "&:hover": { bgcolor: "rgba(255,255,255,0.24)" } }}
					>
						<ChevronRightIcon fontSize="large" />
					</IconButton>
				)}
			</Box>
		</Dialog>
	);
}
