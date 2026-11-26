import { Loader } from "@cloudflare/kumo";
import { MagnifyingGlassIcon } from "@phosphor-icons/react";
import { useQuery } from "@tanstack/react-query";
import { useSearchParams } from "react-router";
import { EmptyState, ItemList } from "~/components/ItemList";
import { api } from "~/lib/api";

export default function Search() {
	const [params] = useSearchParams();
	const q = params.get("q") ?? "";
	const { data, isLoading } = useQuery({ queryKey: ["search", q], queryFn: () => api.search(q), enabled: !!q });

	return (
		<div className="mx-auto max-w-5xl">
			<h1 className="mb-4 truncate text-lg font-semibold">Results for "{q}"</h1>
			{isLoading ? (
				<div className="flex justify-center py-16">
					<Loader size="lg" />
				</div>
			) : (
				<ItemList
					items={data?.items ?? []}
					mode="search"
					empty={<EmptyState icon={<MagnifyingGlassIcon size={48} className="text-kumo-inactive" />} title="No matches" description="Search looks at file and folder names." />}
				/>
			)}
		</div>
	);
}
