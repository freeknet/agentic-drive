import { Button, Empty, LinkProvider, Loader, Toasty, TooltipProvider } from "@cloudflare/kumo";
import { WarningIcon } from "@phosphor-icons/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { forwardRef, useState } from "react";
import { isRouteErrorResponse, Links, Meta, Outlet, Link as RouterLink, Scripts, ScrollRestoration } from "react-router";
import { THEME_BOOTSTRAP } from "~/hooks/useTheme";
import { ApiError } from "~/lib/api";
import "./index.css";

function makeQueryClient() {
	return new QueryClient({
		defaultOptions: {
			queries: {
				staleTime: 15_000,
				refetchOnWindowFocus: false,
				retry: (n, e) => !(e instanceof ApiError && e.status >= 400 && e.status < 500) && n < 2,
			},
		},
	});
}

let browserQueryClient: QueryClient | undefined;
function getQueryClient() {
	if (typeof window === "undefined") return makeQueryClient();
	browserQueryClient ??= makeQueryClient();
	return browserQueryClient;
}

const KumoLink = forwardRef<HTMLAnchorElement, React.AnchorHTMLAttributes<HTMLAnchorElement> & { href?: string }>(
	function KumoLink({ href, ...props }, ref) {
		if (href && !href.startsWith("http")) return <RouterLink to={href} ref={ref} {...(props as Record<string, unknown>)} />;
		return <a href={href} ref={ref} {...props} />;
	},
);

export function Layout({ children }: { children: React.ReactNode }) {
	return (
		<html lang="en" data-theme="kumo" data-mode="light" suppressHydrationWarning>
			<head>
				<meta charSet="UTF-8" />
				<link rel="icon" type="image/svg+xml" href="/favicon.svg" />
				<meta name="viewport" content="width=device-width, initial-scale=1.0" />
				<meta name="color-scheme" content="light dark" />
				{/* biome-ignore lint/security/noDangerouslySetInnerHtml: static theme bootstrap, no user input */}
				<script dangerouslySetInnerHTML={{ __html: THEME_BOOTSTRAP }} />
				<title>Drive</title>
				<Meta />
				<Links />
			</head>
			<body className="bg-kumo-recessed text-kumo-default antialiased">
				{children}
				<ScrollRestoration />
				<Scripts />
			</body>
		</html>
	);
}

export function HydrateFallback() {
	return (
		<div className="flex h-screen items-center justify-center">
			<Loader size="lg" />
		</div>
	);
}

export default function App() {
	const [queryClient] = useState(getQueryClient);
	return (
		<QueryClientProvider client={queryClient}>
			<LinkProvider component={KumoLink}>
				<TooltipProvider>
					<Toasty>
						<Outlet />
					</Toasty>
				</TooltipProvider>
			</LinkProvider>
		</QueryClientProvider>
	);
}

export function ErrorBoundary({ error }: { error: unknown }) {
	const notFound = isRouteErrorResponse(error) && error.status === 404;
	return (
		<div className="flex min-h-screen items-center justify-center p-8">
			<Empty
				icon={<WarningIcon size={48} className="text-kumo-inactive" />}
				title={notFound ? "Page not found" : "Something went wrong"}
				description={notFound ? "That folder or page doesn't exist." : "Please try again."}
				contents={
					<Button variant="primary" onClick={() => (window.location.href = "/")}>
						Go to My Drive
					</Button>
				}
			/>
		</div>
	);
}
