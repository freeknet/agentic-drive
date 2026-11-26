/**
 * Shared Drive state and actions: selection, view mode, details panel, the
 * right-click menu, the snackbar (with Undo), and every item action, for one
 * item or a selection. Dialogs are hosted here once and opened by actions.
 */
import Alert from "@mui/material/Alert";
import Button from "@mui/material/Button";
import Snackbar from "@mui/material/Snackbar";
import { useQueryClient } from "@tanstack/react-query";
import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from "react";
import { api, ApiError, contentUrl, type Item } from "~/lib/api";
import { enqueue } from "~/lib/uploads";
import { ContextMenu, type MenuTarget } from "./ContextMenu";
import { ConfirmDialog, MoveDialog, NameDialog, PreviewDialog, ShareDialog } from "./dialogs";

export type ViewMode = "grid" | "list";

type Dialog =
	| { kind: "new-folder"; parentId: string | null }
	| { kind: "rename"; item: Item }
	| { kind: "move"; items: Item[] }
	| { kind: "share"; item: Item }
	| { kind: "preview"; item: Item; siblings: Item[] }
	| { kind: "purge"; items: Item[] }
	| null;

type Toast = { key: number; message: string; severity?: "success" | "error" | "info"; undo?: () => Promise<unknown> };

export interface Drive {
	// selection
	selected: Set<string>;
	setSelected: (ids: Set<string>) => void;
	clearSelection: () => void;
	// view
	view: ViewMode;
	setView: (v: ViewMode) => void;
	detailsOpen: boolean;
	setDetailsOpen: (open: boolean) => void;
	// menus
	openMenu: (e: { clientX: number; clientY: number }, target: MenuTarget) => void;
	// actions
	notify: (message: string, opts?: Omit<Toast, "key" | "message">) => void;
	refresh: () => void;
	newFolder: (parentId: string | null) => void;
	uploadFiles: (parentId: string | null) => void;
	rename: (item: Item) => void;
	move: (items: Item[]) => void;
	moveTo: (items: Item[], parentId: string | null) => Promise<void>;
	share: (item: Item) => void;
	copyLink: (item: Item) => Promise<void>;
	preview: (item: Item, siblings?: Item[]) => void;
	open: (item: Item, siblings?: Item[]) => void;
	download: (items: Item[]) => void;
	star: (items: Item[], on: boolean) => Promise<void>;
	trash: (items: Item[]) => Promise<void>;
	restore: (items: Item[]) => Promise<void>;
	purge: (items: Item[]) => void;
}

const Ctx = createContext<Drive | null>(null);

export function useDrive(): Drive {
	const d = useContext(Ctx);
	if (!d) throw new Error("useDrive outside DriveProvider");
	return d;
}

const VIEW_KEY = "drive-view";
const plural = (n: number, one: string) => `${n} ${one}${n === 1 ? "" : "s"}`;
const label = (items: Item[]) => (items.length === 1 ? `"${items[0].name}"` : plural(items.length, "item"));
const errorText = (e: unknown) => (e instanceof ApiError ? e.message : "Something went wrong");

export function DriveProvider({ children, navigateTo }: { children: ReactNode; navigateTo: (path: string) => void }) {
	const qc = useQueryClient();
	const [selected, setSelected] = useState<Set<string>>(new Set());
	const [view, setViewState] = useState<ViewMode>(() => {
		try {
			return (typeof window !== "undefined" && (localStorage.getItem(VIEW_KEY) as ViewMode)) || "list";
		} catch {
			return "list";
		}
	});
	const [detailsOpen, setDetailsOpen] = useState(false);
	const [dialog, setDialog] = useState<Dialog>(null);
	const [menu, setMenu] = useState<{ x: number; y: number; target: MenuTarget } | null>(null);
	const [toast, setToast] = useState<Toast | null>(null);
	const fileInput = useRef<HTMLInputElement>(null);
	const uploadParent = useRef<string | null>(null);

	const refresh = useCallback(() => void qc.invalidateQueries(), [qc]);
	const notify = useCallback((message: string, opts: Omit<Toast, "key" | "message"> = {}) => setToast({ key: Date.now(), message, ...opts }), []);
	const setView = useCallback((v: ViewMode) => {
		setViewState(v);
		try {
			localStorage.setItem(VIEW_KEY, v);
		} catch {
			// private mode
		}
	}, []);

	/** Run an action over items; report one message; offer Undo when given. */
	const batch = useCallback(
		async (items: Item[], fn: (i: Item) => Promise<unknown>, done: string, undo?: (i: Item) => Promise<unknown>) => {
			const results = await Promise.allSettled(items.map(fn));
			const failed = results.filter((r) => r.status === "rejected") as PromiseRejectedResult[];
			const ok = items.filter((_, i) => results[i].status === "fulfilled");
			refresh();
			if (failed.length) notify(failed.length === items.length ? errorText(failed[0].reason) : `${done}; ${failed.length} failed`, { severity: "error" });
			else
				notify(done, {
					undo: undo
						? async () => {
								await Promise.allSettled(ok.map(undo));
								refresh();
							}
						: undefined,
				});
		},
		[notify, refresh],
	);

	const drive = useMemo<Drive>(() => {
		const d: Drive = {
			selected,
			setSelected,
			clearSelection: () => setSelected(new Set()),
			view,
			setView,
			detailsOpen,
			setDetailsOpen,
			openMenu: (e, target) => setMenu({ x: e.clientX, y: e.clientY, target }),
			notify,
			refresh,
			newFolder: (parentId) => setDialog({ kind: "new-folder", parentId }),
			uploadFiles: (parentId) => {
				uploadParent.current = parentId;
				fileInput.current?.click();
			},
			rename: (item) => setDialog({ kind: "rename", item }),
			move: (items) => setDialog({ kind: "move", items }),
			moveTo: async (items, parentId) => {
				const movable = items.filter((i) => i.id !== parentId && i.parent_id !== parentId);
				if (!movable.length) return;
				const from = new Map(movable.map((i) => [i.id, i.parent_id]));
				await batch(movable, (i) => api.move(i.id, parentId), `Moved ${label(movable)}`, (i) => api.move(i.id, from.get(i.id) ?? null));
			},
			share: (item) => setDialog({ kind: "share", item }),
			copyLink: async (item) => {
				try {
					const { shares } = await api.shares(item.id);
					const url = shares[0]?.url ?? (await api.share(item.id, 30)).url;
					await navigator.clipboard.writeText(url);
					notify("Link copied. Anyone with it can download the file.");
					refresh();
				} catch (e) {
					notify(e instanceof ApiError ? e.message : "Couldn't copy the link; open Share to copy it", { severity: "error" });
				}
			},
			preview: (item, siblings = [item]) => setDialog({ kind: "preview", item, siblings }),
			open: (item, siblings) => {
				if (item.trashed_at) return;
				if (item.kind === "folder") navigateTo(`/folder/${item.id}`);
				else d.preview(item, siblings);
			},
			download: (items) => {
				const files = items.filter((i) => i.kind === "file");
				files.forEach((f, n) =>
					setTimeout(() => {
						const a = document.createElement("a");
						a.href = contentUrl(f.id, true);
						a.download = f.name;
						document.body.appendChild(a);
						a.click();
						a.remove();
					}, n * 400),
				);
				if (items.some((i) => i.kind === "folder")) notify("Folders can't be downloaded yet; open them to download files", { severity: "info" });
			},
			star: (items, on) =>
				batch(items, (i) => api.setStarred(i.id, on), on ? `Starred ${label(items)}` : `Removed ${label(items)} from Starred`, (i) =>
					api.setStarred(i.id, !on),
				),
			trash: async (items) => {
				await batch(items, (i) => api.trashItem(i.id), `Moved ${label(items)} to the trash`, (i) => api.restore(i.id));
				setSelected(new Set());
			},
			restore: async (items) => {
				await batch(items, (i) => api.restore(i.id), `Restored ${label(items)}`);
				setSelected(new Set());
			},
			purge: (items) => setDialog({ kind: "purge", items }),
		};
		return d;
	}, [selected, view, setView, detailsOpen, notify, refresh, batch, navigateTo]);

	const close = () => setDialog(null);

	return (
		<Ctx.Provider value={drive}>
			{children}
			<input
				ref={fileInput}
				type="file"
				multiple
				hidden
				onChange={(e) => {
					if (e.target.files?.length) enqueue(e.target.files, uploadParent.current);
					e.target.value = "";
				}}
			/>
			{menu && <ContextMenu x={menu.x} y={menu.y} target={menu.target} onClose={() => setMenu(null)} />}
			{dialog?.kind === "new-folder" && (
				<NameDialog
					title="New folder"
					initial=""
					placeholder="Untitled folder"
					submitLabel="Create"
					onClose={close}
					onSubmit={async (name) => {
						await api.createFolder(dialog.parentId, name);
						refresh();
					}}
				/>
			)}
			{dialog?.kind === "rename" && (
				<NameDialog
					title="Rename"
					initial={dialog.item.name}
					submitLabel="OK"
					selectStem={dialog.item.kind === "file"}
					onClose={close}
					onSubmit={async (name) => {
						await api.rename(dialog.item.id, name);
						refresh();
					}}
				/>
			)}
			{dialog?.kind === "move" && <MoveDialog items={dialog.items} onClose={close} onMove={(parentId) => drive.moveTo(dialog.items, parentId)} />}
			{dialog?.kind === "share" && <ShareDialog item={dialog.item} onClose={close} notify={notify} />}
			{dialog?.kind === "preview" && (
				<PreviewDialog
					item={dialog.item}
					siblings={dialog.siblings}
					onNavigate={(item) => setDialog({ ...dialog, item })}
					onClose={close}
					onShare={(item) => setDialog({ kind: "share", item })}
				/>
			)}
			{dialog?.kind === "purge" && (
				<ConfirmDialog
					title={`Delete ${label(dialog.items)} for good?`}
					body="They and everything inside will be deleted permanently, with their share links. This can't be undone."
					confirmLabel="Delete for good"
					onClose={close}
					onConfirm={async () => {
						await batch(dialog.items, (i) => api.purge(i.id), `Deleted ${label(dialog.items)} for good`);
						setSelected(new Set());
					}}
				/>
			)}
			<Snackbar
				key={toast?.key}
				open={!!toast}
				autoHideDuration={toast?.undo ? 8000 : 5000}
				onClose={(_, reason) => reason !== "clickaway" && setToast(null)}
				anchorOrigin={{ vertical: "bottom", horizontal: "left" }}
			>
				{toast ? (
					<Alert
						severity={toast.severity ?? "info"}
						variant="filled"
						icon={toast.severity === "error" ? undefined : false}
						onClose={() => setToast(null)}
						action={
							toast.undo ? (
								<Button
									color="inherit"
									size="small"
									onClick={async () => {
										const undo = toast.undo!;
										setToast(null);
										await undo();
									}}
								>
									Undo
								</Button>
							) : undefined
						}
						sx={{ alignItems: "center", ...(toast.severity !== "error" && { bgcolor: "#323232", color: "#fff" }) }}
					>
						{toast.message}
					</Alert>
				) : undefined}
			</Snackbar>
		</Ctx.Provider>
	);
}
