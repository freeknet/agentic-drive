import { index, layout, route, type RouteConfig } from "@react-router/dev/routes";

export default [
	layout("routes/layout.tsx", [
		index("routes/view.tsx", { id: "my-drive" }),
		route("folder/:folderId", "routes/view.tsx", { id: "folder" }),
		route("recent", "routes/view.tsx", { id: "recent" }),
		route("starred", "routes/view.tsx", { id: "starred" }),
		route("search", "routes/view.tsx", { id: "search" }),
		route("trash", "routes/view.tsx", { id: "trash" }),
	]),
	route("*", "routes/not-found.tsx"),
] satisfies RouteConfig;
