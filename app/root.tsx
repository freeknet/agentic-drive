import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import CssBaseline from "@mui/material/CssBaseline";
import InitColorSchemeScript from "@mui/material/InitColorSchemeScript";
import Stack from "@mui/material/Stack";
import { ThemeProvider } from "@mui/material/styles";
import Typography from "@mui/material/Typography";
import CloudOffIcon from "@mui/icons-material/CloudOffOutlined";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";
import { isRouteErrorResponse, Links, Meta, Outlet, Scripts, ScrollRestoration } from "react-router";
import { ApiError } from "~/lib/api";
import { ConfirmHost } from "~/lib/confirm";
import PreferencesApplier from "~/components/PreferencesApplier";
import { theme } from "~/theme";

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

export function Layout({ children }: { children: React.ReactNode }) {
	return (
		<html lang="en" suppressHydrationWarning>
			<head>
				<meta charSet="UTF-8" />
				<link rel="icon" type="image/svg+xml" href="/favicon.svg" />
				<meta name="viewport" content="width=device-width, initial-scale=1.0" />
				<meta name="color-scheme" content="light dark" />
				<title>Drive</title>
				<Meta />
				<Links />
			</head>
			<body>
				<InitColorSchemeScript attribute="class" defaultMode="system" />
				<ThemeProvider theme={theme} defaultMode="system">
					<CssBaseline enableColorScheme />
					<PreferencesApplier />
					{children}
					<ConfirmHost />
				</ThemeProvider>
				<ScrollRestoration />
				<Scripts />
			</body>
		</html>
	);
}

export function HydrateFallback() {
	return (
		<Stack sx={{ height: "100dvh", alignItems: "center", justifyContent: "center" }}>
			<CircularProgress />
		</Stack>
	);
}

export default function App() {
	const [queryClient] = useState(getQueryClient);
	return (
		<QueryClientProvider client={queryClient}>
			<Outlet />
		</QueryClientProvider>
	);
}

export function ErrorBoundary({ error }: { error: unknown }) {
	const notFound = isRouteErrorResponse(error) && error.status === 404;
	return (
		<Stack spacing={2} sx={{ minHeight: "100dvh", alignItems: "center", justifyContent: "center", p: 4, textAlign: "center" }}>
			<CloudOffIcon sx={{ fontSize: 64, color: "text.secondary" }} />
			<Typography variant="h6">{notFound ? "Page not found" : "Something went wrong"}</Typography>
			<Typography color="text.secondary">{notFound ? "That folder or page doesn't exist." : "Please try again."}</Typography>
			<Button variant="contained" href="/">
				Go to My Drive
			</Button>
		</Stack>
	);
}
