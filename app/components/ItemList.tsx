import { Button, DropdownMenu, Empty } from "@cloudflare/kumo";
import {
	ArrowCounterClockwiseIcon,
	ArrowsOutCardinalIcon,
	DotsThreeVerticalIcon,
	DownloadSimpleIcon,
	EyeIcon,
	PencilSimpleIcon,
	ShareNetworkIcon,
	TrashIcon,
	XCircleIcon,
} from "@phosphor-icons/react";
import type { ReactNode } from "react";
import { useNavigate } from "react-router";
import { contentUrl, type Item } from "~/lib/api";
import { formatBytes, formatDate, iconFor } from "~/lib/format";
import { useActions } from "./actions";

type Mode = "browse" | "search" | "trash";

function Actions({ item, siblings, mode }: { item: Item; siblings: Item[]; mode: Mode }) {
	const a = useActions();
	const navigate = useNavigate();
	return (
		<DropdownMenu>
			<DropdownMenu.Trigger
				render={<Button variant="ghost" shape="square" size="sm" icon={<DotsThreeVerticalIcon size={18} weight="bold" />} aria-label={`Actions for ${item.name}`} />}
			/>
			<DropdownMenu.Content align="end">
				{mode === "trash" ? (
					<>
						<DropdownMenu.Item icon={ArrowCounterClockwiseIcon} onClick={() => a.restore(item)}>
							Restore
						</DropdownMenu.Item>
						<DropdownMenu.Item icon={XCircleIcon} variant="danger" onClick={() => a.purge(item)}>
							Delete for good
						</DropdownMenu.Item>
					</>
				) : (
					<>
						{item.kind === "file" ? (
							<>
								<DropdownMenu.Item icon={EyeIcon} onClick={() => a.preview(item, siblings)}>
									Preview
								</DropdownMenu.Item>
								<DropdownMenu.Item icon={DownloadSimpleIcon} onClick={() => (window.location.href = contentUrl(item.id, true))}>
									Download
								</DropdownMenu.Item>
								<DropdownMenu.Item icon={ShareNetworkIcon} onClick={() => a.share(item)}>
									Share link
								</DropdownMenu.Item>
							</>
						) : (
							<DropdownMenu.Item icon={EyeIcon} onClick={() => navigate(`/folder/${item.id}`)}>
								Open
							</DropdownMenu.Item>
						)}
						<DropdownMenu.Separator />
						<DropdownMenu.Item icon={PencilSimpleIcon} onClick={() => a.rename(item)}>
							Rename
						</DropdownMenu.Item>
						<DropdownMenu.Item icon={ArrowsOutCardinalIcon} onClick={() => a.move(item)}>
							Move
						</DropdownMenu.Item>
						<DropdownMenu.Separator />
						<DropdownMenu.Item icon={TrashIcon} variant="danger" onClick={() => a.trash(item)}>
							Move to trash
						</DropdownMenu.Item>
					</>
				)}
			</DropdownMenu.Content>
		</DropdownMenu>
	);
}

export function ItemList({ items, mode, empty }: { items: Item[]; mode: Mode; empty: ReactNode }) {
	const a = useActions();
	const navigate = useNavigate();

	if (items.length === 0) return <div className="py-16">{empty}</div>;

	const open = (item: Item) => {
		if (mode === "trash") return;
		if (item.kind === "folder") navigate(`/folder/${item.id}`);
		else a.preview(item, items);
	};

	return (
		<div className="overflow-hidden rounded-lg border border-kumo-line bg-kumo-base">
			<div className="hidden grid-cols-[minmax(0,1fr)_7rem_8rem_2.5rem] gap-3 border-b border-kumo-line px-4 py-2 text-xs font-medium text-kumo-subtle sm:grid">
				<span>Name</span>
				<span className="text-right">Size</span>
				<span>{mode === "trash" ? "Trashed" : "Modified"}</span>
				<span />
			</div>
			<ul>
				{items.map((item) => {
					const Icon = iconFor(item);
					return (
						<li
							key={item.id}
							className="grid grid-cols-[minmax(0,1fr)_2.5rem] items-center gap-3 border-b border-kumo-line px-4 py-1.5 last:border-b-0 hover:bg-kumo-tint sm:grid-cols-[minmax(0,1fr)_7rem_8rem_2.5rem]"
						>
							<button
								type="button"
								onClick={() => open(item)}
								className="flex min-w-0 items-center gap-3 py-1 text-left"
								disabled={mode === "trash"}
							>
								<Icon size={22} weight={item.kind === "folder" ? "fill" : "duotone"} className={item.kind === "folder" ? "shrink-0 text-kumo-subtle" : "shrink-0 text-kumo-brand"} />
								<span className="min-w-0">
									<span className="block truncate text-sm">{item.name}</span>
									<span className="block truncate text-xs text-kumo-subtle sm:hidden">
										{item.kind === "file" ? `${formatBytes(item.size)} · ` : ""}
										{formatDate(mode === "trash" && item.trashed_at ? item.trashed_at : item.updated_at)}
									</span>
									{mode === "search" && (
										<span className="hidden truncate text-xs text-kumo-subtle sm:block">in {item.parent_name ?? "My Drive"}</span>
									)}
								</span>
							</button>
							<span className="hidden text-right text-sm text-kumo-subtle sm:block">{item.kind === "file" ? formatBytes(item.size) : "—"}</span>
							<span className="hidden text-sm text-kumo-subtle sm:block">
								{formatDate(mode === "trash" && item.trashed_at ? item.trashed_at : item.updated_at)}
							</span>
							<Actions item={item} siblings={items} mode={mode} />
						</li>
					);
				})}
			</ul>
		</div>
	);
}

export function EmptyState({ icon, title, description }: { icon: ReactNode; title: string; description: string }) {
	return <Empty icon={icon} title={title} description={description} />;
}
