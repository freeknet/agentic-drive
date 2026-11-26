import { index, layout, route, type RouteConfig } from "@react-router/dev/routes";

export default [
	layout("routes/layout.tsx", [
		index("routes/browser.tsx", { id: "root-folder" }),
		route("folder/:folderId", "routes/browser.tsx", { id: "folder" }),
		route("search", "routes/search.tsx"),
		route("trash", "routes/trash.tsx"),
	]),
	route("*", "routes/not-found.tsx"),
] satisfies RouteConfig;
