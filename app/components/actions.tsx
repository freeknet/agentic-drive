/**
 * Item actions shared by every view: the dialogs (new folder, rename, move,
 * share, preview) live once in the layout and are opened through this context.
 */
import { useKumoToastManager } from "@cloudflare/kumo";
import { useQueryClient } from "@tanstack/react-query";
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { api, ApiError, type Item } from "~/lib/api";
import { MoveDialog, NameDialog, PreviewDialog, ShareDialog } from "./dialogs";

type Open =
	| { kind: "new-folder"; parentId: string | null }
	| { kind: "rename"; item: Item }
	| { kind: "move"; item: Item }
	| { kind: "share"; item: Item }
	| { kind: "preview"; item: Item; siblings: Item[] }
	| null;

type Actions = {
	newFolder: (parentId: string | null) => void;
	rename: (item: Item) => void;
	move: (item: Item) => void;
	share: (item: Item) => void;
	preview: (item: Item, siblings?: Item[]) => void;
	trash: (item: Item) => Promise<void>;
	restore: (item: Item) => Promise<void>;
	purge: (item: Item) => Promise<void>;
	refresh: () => void;
};

const Ctx = createContext<Actions | null>(null);

export function useActions(): Actions {
	const a = useContext(Ctx);
	if (!a) throw new Error("useActions outside ActionsProvider");
	return a;
}

export function ActionsProvider({ children }: { children: ReactNode }) {
	const [open, setOpen] = useState<Open>(null);
	const qc = useQueryClient();
	const toast = useKumoToastManager();
	const close = useCallback(() => setOpen(null), []);
	const refresh = useCallback(() => {
		void qc.invalidateQueries();
	}, [qc]);

	const run = useCallback(
		async (fn: () => Promise<unknown>, done: string, undo?: () => Promise<unknown>) => {
			try {
				await fn();
				refresh();
				toast.add({
					title: done,
					...(undo
						? {
								actions: [
									{
										children: "Undo",
										onClick: async () => {
											await undo();
											refresh();
										},
									},
								],
							}
						: {}),
				});
			} catch (e) {
				toast.add({ title: e instanceof ApiError ? e.message : "Something went wrong", variant: "error" });
			}
		},
		[refresh, toast],
	);

	const actions = useMemo<Actions>(
		() => ({
			newFolder: (parentId) => setOpen({ kind: "new-folder", parentId }),
			rename: (item) => setOpen({ kind: "rename", item }),
			move: (item) => setOpen({ kind: "move", item }),
			share: (item) => setOpen({ kind: "share", item }),
			preview: (item, siblings = [item]) => setOpen({ kind: "preview", item, siblings }),
			trash: (item) => run(() => api.trashItem(item.id), `Moved "${item.name}" to the trash`, () => api.restore(item.id)),
			restore: (item) => run(() => api.restore(item.id), `Restored "${item.name}"`),
			purge: (item) => run(() => api.purge(item.id), `Deleted "${item.name}" for good`),
			refresh,
		}),
		[run, refresh],
	);

	return (
		<Ctx.Provider value={actions}>
			{children}
			{open?.kind === "new-folder" && (
				<NameDialog
					title="New folder"
					initial=""
					placeholder="Untitled folder"
					submitLabel="Create"
					onClose={close}
					onSubmit={async (name) => {
						await api.createFolder(open.parentId, name);
						refresh();
					}}
				/>
			)}
			{open?.kind === "rename" && (
				<NameDialog
					title="Rename"
					initial={open.item.name}
					submitLabel="Rename"
					selectStem={open.item.kind === "file"}
					onClose={close}
					onSubmit={async (name) => {
						await api.rename(open.item.id, name);
						refresh();
					}}
				/>
			)}
			{open?.kind === "move" && (
				<MoveDialog
					item={open.item}
					onClose={close}
					onMove={async (parentId) => {
						await api.move(open.item.id, parentId);
						refresh();
						toast.add({ title: `Moved "${open.item.name}"` });
					}}
				/>
			)}
			{open?.kind === "share" && <ShareDialog item={open.item} onClose={close} />}
			{open?.kind === "preview" && (
				<PreviewDialog
					item={open.item}
					siblings={open.siblings}
					onNavigate={(item) => setOpen({ ...open, item })}
					onClose={close}
					onShare={(item) => setOpen({ kind: "share", item })}
				/>
			)}
		</Ctx.Provider>
	);
}
