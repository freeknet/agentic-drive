import { EnvelopeSimpleIcon, HardDrivesIcon } from "@phosphor-icons/react";
import { useQuery } from "@tanstack/react-query";
import { api } from "~/lib/api";

/**
 * Mail | Drive switcher, mirrored in agentic-inbox's header. Both apps sit
 * behind the same Cloudflare Access team, so following the link needs no
 * second sign-in. Hidden when MAIL_URL isn't set.
 */
export function AppSwitcher() {
	const { data } = useQuery({ queryKey: ["config"], queryFn: api.config, staleTime: Number.POSITIVE_INFINITY });
	if (!data?.mailUrl) return null;
	const base = "flex items-center gap-1.5 rounded-md px-2.5 py-1 text-sm transition-colors";
	return (
		<nav aria-label="Apps" className="flex shrink-0 items-center rounded-lg border border-kumo-line p-0.5">
			<a href={data.mailUrl} className={`${base} text-kumo-subtle hover:text-kumo-default`}>
				<EnvelopeSimpleIcon size={16} weight="duotone" />
				<span className="hidden sm:inline">Mail</span>
			</a>
			<span aria-current="page" className={`${base} bg-kumo-tint font-medium text-kumo-default`}>
				<HardDrivesIcon size={16} weight="duotone" />
				<span className="hidden sm:inline">Drive</span>
			</span>
		</nav>
	);
}
