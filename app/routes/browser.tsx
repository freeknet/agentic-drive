import { Button, Loader } from "@cloudflare/kumo";
import { CaretRightIcon, CloudArrowUpIcon, FolderPlusIcon } from "@phosphor-icons/react";
import { useQuery } from "@tanstack/react-query";
import { Link, useParams } from "react-router";
import { useActions } from "~/components/actions";
import { EmptyState, ItemList } from "~/components/ItemList";
import { api, ApiError } from "~/lib/api";

export default function Browser() {
	const { folderId = null } = useParams();
	const a = useActions();
	const { data, isLoading, error } = useQuery({ queryKey: ["files", folderId], queryFn: () => api.list(folderId) });

	if (error) {
		return (
			<EmptyState
				icon={<FolderPlusIcon size={48} className="text-kumo-inactive" />}
				title={error instanceof ApiError && error.status === 404 ? "Folder not found" : "Couldn't load this folder"}
				description={error instanceof ApiError && error.status === 404 ? "It may have been moved to the trash." : "Please try again."}
			/>
		);
	}

	return (
		<div className="mx-auto max-w-5xl">
			<div className="mb-4 flex items-center gap-2">
				<nav className="flex min-w-0 flex-1 flex-wrap items-center gap-1 text-lg font-semibold" aria-label="Folder path">
					<Link to="/" className={data?.breadcrumbs.length ? "text-kumo-subtle hover:text-kumo-default" : ""}>
						My Drive
					</Link>
					{data?.breadcrumbs.map((b, i) => (
						<span key={b.id} className="flex min-w-0 items-center gap-1">
							<CaretRightIcon size={14} className="text-kumo-subtle" />
							{i === data.breadcrumbs.length - 1 ? (
								<span className="truncate">{b.name}</span>
							) : (
								<Link to={`/folder/${b.id}`} className="truncate text-kumo-subtle hover:text-kumo-default">
									{b.name}
								</Link>
							)}
						</span>
					))}
				</nav>
				<Button variant="secondary" size="sm" icon={<FolderPlusIcon size={16} />} onClick={() => a.newFolder(folderId)}>
					<span className="hidden sm:inline">New folder</span>
				</Button>
			</div>
			{isLoading || !data ? (
				<div className="flex justify-center py-16">
					<Loader size="lg" />
				</div>
			) : (
				<ItemList
					items={data.items}
					mode="browse"
					empty={
						<EmptyState
							icon={<CloudArrowUpIcon size={48} className="text-kumo-inactive" />}
							title="Nothing here yet"
							description="Drop files anywhere on this page, or use New to upload files or make a folder."
						/>
					}
				/>
			)}
		</div>
	);
}
