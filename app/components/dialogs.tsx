import { Button, Dialog, Input, Loader, Select, useKumoToastManager } from "@cloudflare/kumo";
import {
	ArrowLeftIcon,
	ArrowRightIcon,
	CaretRightIcon,
	CopyIcon,
	DownloadSimpleIcon,
	FolderSimpleIcon,
	HouseIcon,
	LinkIcon,
	ShareNetworkIcon,
	TrashIcon,
	XIcon,
} from "@phosphor-icons/react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { api, ApiError, contentUrl, type Item } from "~/lib/api";
import { formatBytes, formatDate, previewKind } from "~/lib/format";

function ErrorText({ error }: { error: string | null }) {
	return error ? <p className="mt-2 text-sm text-kumo-danger">{error}</p> : null;
}

const message = (e: unknown) => (e instanceof ApiError ? e.message : "Something went wrong");

// ── name (new folder / rename) ─────────────────────────────────────

export function NameDialog(props: {
	title: string;
	initial: string;
	/** Shown when empty and used if the box is left empty. */
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

	// The dialog moves focus to the field when it opens; select the name then
	// (only the part before the extension for files), once.
	const onFocus = (e: React.FocusEvent<HTMLInputElement>) => {
		if (selected.current) return;
		selected.current = true;
		const dot = props.selectStem ? props.initial.lastIndexOf(".") : -1;
		e.target.setSelectionRange(0, dot > 0 ? dot : props.initial.length);
	};

	const submit = async (e: React.FormEvent<HTMLFormElement>) => {
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
		<Dialog.Root open onOpenChange={(o) => !o && props.onClose()}>
			<Dialog size="sm" className="p-6">
				<Dialog.Title className="mb-4 text-lg font-semibold">{props.title}</Dialog.Title>
				<form onSubmit={submit}>
					<Input
						autoFocus
						aria-label="Name"
						value={name}
						placeholder={props.placeholder}
						onFocus={onFocus}
						onChange={(e) => setName(e.target.value)}
						className="w-full"
					/>
					<ErrorText error={error} />
					<div className="mt-5 flex justify-end gap-2">
						<Button type="button" variant="secondary" onClick={props.onClose}>
							Cancel
						</Button>
						<Button type="submit" variant="primary" loading={busy}>
							{props.submitLabel}
						</Button>
					</div>
				</form>
			</Dialog>
		</Dialog.Root>
	);
}

// ── move ───────────────────────────────────────────────────────────

export function MoveDialog({ item, onClose, onMove }: { item: Item; onClose: () => void; onMove: (parentId: string | null) => Promise<void> }) {
	const [at, setAt] = useState<string | null>(item.parent_id);
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const { data, isLoading } = useQuery({ queryKey: ["files", at], queryFn: () => api.list(at) });
	const folders = (data?.items ?? []).filter((i) => i.kind === "folder" && i.id !== item.id);

	const move = async () => {
		setBusy(true);
		try {
			await onMove(at);
			onClose();
		} catch (e) {
			setError(message(e));
			setBusy(false);
		}
	};

	return (
		<Dialog.Root open onOpenChange={(o) => !o && onClose()}>
			<Dialog size="sm" className="p-6">
				<Dialog.Title className="mb-1 text-lg font-semibold">Move "{item.name}"</Dialog.Title>
				<nav className="mb-3 flex flex-wrap items-center gap-1 text-sm text-kumo-subtle" aria-label="Folder path">
					<button type="button" className="flex items-center gap-1 hover:text-kumo-default" onClick={() => setAt(null)}>
						<HouseIcon size={14} /> My Drive
					</button>
					{data?.breadcrumbs.map((b) => (
						<span key={b.id} className="flex items-center gap-1">
							<CaretRightIcon size={12} />
							<button type="button" className="hover:text-kumo-default" onClick={() => setAt(b.id)}>
								{b.name}
							</button>
						</span>
					))}
				</nav>
				<div className="h-64 overflow-y-auto rounded-lg border border-kumo-line">
					{isLoading ? (
						<div className="flex h-full items-center justify-center">
							<Loader />
						</div>
					) : folders.length === 0 ? (
						<p className="p-4 text-sm text-kumo-subtle">No folders here.</p>
					) : (
						folders.map((f) => (
							<button
								key={f.id}
								type="button"
								onClick={() => setAt(f.id)}
								className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-kumo-tint"
							>
								<FolderSimpleIcon size={18} weight="fill" className="text-kumo-subtle" />
								<span className="flex-1 truncate">{f.name}</span>
								<CaretRightIcon size={14} className="text-kumo-subtle" />
							</button>
						))
					)}
				</div>
				<ErrorText error={error} />
				<div className="mt-5 flex justify-end gap-2">
					<Button variant="secondary" onClick={onClose}>
						Cancel
					</Button>
					<Button variant="primary" loading={busy} disabled={at === item.parent_id} onClick={move}>
						Move here
					</Button>
				</div>
			</Dialog>
		</Dialog.Root>
	);
}

// ── share ──────────────────────────────────────────────────────────

const EXPIRY = [
	{ value: "7", label: "7 days" },
	{ value: "30", label: "30 days" },
	{ value: "365", label: "1 year" },
	{ value: "never", label: "Never" },
];

export function ShareDialog({ item, onClose }: { item: Item; onClose: () => void }) {
	const toast = useKumoToastManager();
	const qc = useQueryClient();
	const [expiry, setExpiry] = useState("30");
	const [busy, setBusy] = useState(false);
	const { data } = useQuery({ queryKey: ["shares", item.id], queryFn: () => api.shares(item.id) });
	const shares = data?.shares ?? [];

	const copy = async (url: string) => {
		try {
			await navigator.clipboard.writeText(url);
			toast.add({ title: "Link copied" });
		} catch {
			toast.add({ title: "Couldn't copy; select the link and copy it", variant: "error" });
		}
	};

	const create = async () => {
		setBusy(true);
		try {
			const s = await api.share(item.id, expiry === "never" ? null : Number(expiry));
			await qc.invalidateQueries({ queryKey: ["shares", item.id] });
			await copy(s.url);
		} catch (e) {
			toast.add({ title: message(e), variant: "error" });
		} finally {
			setBusy(false);
		}
	};

	const revoke = async (token: string) => {
		await api.revokeShare(token);
		await qc.invalidateQueries({ queryKey: ["shares", item.id] });
		toast.add({ title: "Link turned off" });
	};

	return (
		<Dialog.Root open onOpenChange={(o) => !o && onClose()}>
			<Dialog size="base" className="p-6">
				<Dialog.Title className="mb-1 text-lg font-semibold">Share "{item.name}"</Dialog.Title>
				<p className="mb-4 text-sm text-kumo-subtle">Anyone with the link can download this file. No sign-in needed.</p>
				<div className="flex flex-wrap items-end gap-2">
					<div className="min-w-40 flex-1">
						<Select label="Link expires after" value={expiry} onValueChange={(v) => setExpiry(String(v))} items={EXPIRY} />
					</div>
					<Button variant="primary" icon={<LinkIcon size={16} />} loading={busy} onClick={create}>
						Create link
					</Button>
				</div>
				{shares.length > 0 && (
					<div className="mt-5 space-y-2">
						<div className="text-xs font-medium uppercase tracking-wide text-kumo-subtle">Active links</div>
						{shares.map((s) => (
							<div key={s.token} className="flex items-center gap-2 rounded-lg border border-kumo-line p-2">
								<div className="min-w-0 flex-1">
									<input readOnly value={s.url} aria-label="Share link" onFocus={(e) => e.target.select()} className="w-full truncate bg-transparent text-sm outline-none" />
									<div className="text-xs text-kumo-subtle">
										{s.expires_at ? `Expires ${formatDate(s.expires_at)}` : "Never expires"} · {s.downloads} download{s.downloads === 1 ? "" : "s"}
									</div>
								</div>
								<Button variant="ghost" shape="square" size="sm" icon={<CopyIcon size={16} />} aria-label="Copy link" onClick={() => copy(s.url)} />
								<Button variant="ghost" shape="square" size="sm" icon={<TrashIcon size={16} />} aria-label="Turn off link" onClick={() => revoke(s.token)} />
							</div>
						))}
					</div>
				)}
				<div className="mt-5 flex justify-end">
					<Button variant="secondary" onClick={onClose}>
						Done
					</Button>
				</div>
			</Dialog>
		</Dialog.Root>
	);
}

// ── preview ────────────────────────────────────────────────────────

function TextPreview({ id }: { id: string }) {
	const { data, isLoading } = useQuery({ queryKey: ["text", id], queryFn: () => fetch(contentUrl(id)).then((r) => r.text()) });
	if (isLoading) return <Loader />;
	return <pre className="max-h-full w-full overflow-auto whitespace-pre-wrap break-words rounded-lg bg-kumo-base p-4 text-left font-mono text-xs text-kumo-default">{data}</pre>;
}

export function PreviewDialog(props: {
	item: Item;
	siblings: Item[];
	onNavigate: (item: Item) => void;
	onClose: () => void;
	onShare: (item: Item) => void;
}) {
	const { item } = props;
	const files = props.siblings.filter((s) => s.kind === "file");
	const index = files.findIndex((f) => f.id === item.id);
	const prev = index > 0 ? files[index - 1] : null;
	const next = index >= 0 && index < files.length - 1 ? files[index + 1] : null;
	const kind = previewKind(item);
	const src = contentUrl(item.id);

	useEffect(() => {
		const onKey = (e: KeyboardEvent) => {
			if (e.key === "ArrowLeft" && prev) props.onNavigate(prev);
			if (e.key === "ArrowRight" && next) props.onNavigate(next);
		};
		window.addEventListener("keydown", onKey);
		return () => window.removeEventListener("keydown", onKey);
	}, [prev, next, props]);

	return (
		<Dialog.Root open onOpenChange={(o) => !o && props.onClose()}>
			<Dialog size="xl" className="flex h-[90vh] w-[min(1100px,96vw)] max-w-none flex-col p-0">
				<div className="flex items-center gap-2 border-b border-kumo-line px-4 py-3">
					<Dialog.Title className="min-w-0 flex-1 truncate text-sm font-semibold">{item.name}</Dialog.Title>
					<span className="hidden text-xs text-kumo-subtle sm:inline">{formatBytes(item.size)}</span>
					<Button variant="ghost" shape="square" size="sm" icon={<ShareNetworkIcon size={18} />} aria-label="Share" onClick={() => props.onShare(item)} />
					<a href={contentUrl(item.id, true)} aria-label="Download" className="inline-flex h-8 w-8 items-center justify-center rounded-md hover:bg-kumo-tint">
						<DownloadSimpleIcon size={18} />
					</a>
					<Button variant="ghost" shape="square" size="sm" icon={<XIcon size={18} />} aria-label="Close" onClick={props.onClose} />
				</div>
				<div className="relative flex min-h-0 flex-1 items-center justify-center bg-kumo-recessed p-4">
					{kind === "image" && <img src={src} alt={item.name} className="max-h-full max-w-full object-contain" />}
					{kind === "video" && <video key={item.id} src={src} controls autoPlay className="max-h-full max-w-full" />}
					{kind === "audio" && <audio key={item.id} src={src} controls autoPlay />}
					{kind === "pdf" && <iframe key={item.id} src={src} title={item.name} className="h-full w-full rounded-lg bg-white" />}
					{kind === "text" && <TextPreview id={item.id} />}
					{kind === null && (
						<div className="text-center">
							<p className="mb-4 text-sm text-kumo-subtle">No preview for this kind of file.</p>
							<a href={contentUrl(item.id, true)} className="inline-flex items-center gap-2 rounded-lg bg-kumo-brand px-4 py-2 text-sm font-semibold text-white">
								<DownloadSimpleIcon size={16} /> Download
							</a>
						</div>
					)}
					{prev && (
						<Button
							variant="secondary"
							shape="circle"
							icon={<ArrowLeftIcon size={18} />}
							aria-label="Previous file"
							className="absolute left-3 top-1/2 -translate-y-1/2"
							onClick={() => props.onNavigate(prev)}
						/>
					)}
					{next && (
						<Button
							variant="secondary"
							shape="circle"
							icon={<ArrowRightIcon size={18} />}
							aria-label="Next file"
							className="absolute right-3 top-1/2 -translate-y-1/2"
							onClick={() => props.onNavigate(next)}
						/>
					)}
				</div>
			</Dialog>
		</Dialog.Root>
	);
}
