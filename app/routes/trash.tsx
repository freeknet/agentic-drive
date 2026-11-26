import { Button, Dialog, Loader, useKumoToastManager } from "@cloudflare/kumo";
import { TrashIcon } from "@phosphor-icons/react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { EmptyState, ItemList } from "~/components/ItemList";
import { api } from "~/lib/api";

export default function Trash() {
	const { data, isLoading } = useQuery({ queryKey: ["trash"], queryFn: api.trash });
	const qc = useQueryClient();
	const toast = useKumoToastManager();
	const [confirming, setConfirming] = useState(false);
	const [busy, setBusy] = useState(false);
	const items = data?.items ?? [];

	const empty = async () => {
		setBusy(true);
		try {
			const r = await api.emptyTrash();
			toast.add({ title: `Deleted ${r.deleted} item${r.deleted === 1 ? "" : "s"} for good` });
			await qc.invalidateQueries();
		} finally {
			setBusy(false);
			setConfirming(false);
		}
	};

	return (
		<div className="mx-auto max-w-5xl">
			<div className="mb-4 flex items-center gap-2">
				<h1 className="flex-1 text-lg font-semibold">Trash</h1>
				{items.length > 0 && (
					<Button variant="secondary" size="sm" onClick={() => setConfirming(true)}>
						Empty trash
					</Button>
				)}
			</div>
			<p className="mb-4 text-sm text-kumo-subtle">Items in the trash are deleted for good after 30 days. Their share links stop working right away.</p>
			{isLoading ? (
				<div className="flex justify-center py-16">
					<Loader size="lg" />
				</div>
			) : (
				<ItemList items={items} mode="trash" empty={<EmptyState icon={<TrashIcon size={48} className="text-kumo-inactive" />} title="Trash is empty" description="Nothing to clean up." />} />
			)}
			{confirming && (
				<Dialog.Root open onOpenChange={(o) => !o && setConfirming(false)}>
					<Dialog size="sm" className="p-6">
						<Dialog.Title className="mb-2 text-lg font-semibold">Empty the trash?</Dialog.Title>
						<p className="text-sm text-kumo-subtle">
							{items.length} item{items.length === 1 ? "" : "s"} and everything inside will be deleted for good. This can't be undone.
						</p>
						<div className="mt-5 flex justify-end gap-2">
							<Button variant="secondary" onClick={() => setConfirming(false)}>
								Cancel
							</Button>
							<Button variant="destructive" loading={busy} onClick={empty}>
								Delete for good
							</Button>
						</div>
					</Dialog>
				</Dialog.Root>
			)}
		</div>
	);
}
