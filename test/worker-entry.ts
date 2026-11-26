// Test entry for @cloudflare/vitest-plugin. The production entry (workers/app.ts)
// imports the React Router server build, which only exists inside Vite, and
// enforces Access; tests drive the API, share routes and service directly.
import { Hono } from "hono";
import { api } from "../workers/api";
import { share } from "../workers/share";
import type { Env } from "../workers/types";

export { DriveDO } from "../workers/drive-do";
export { DriveService } from "../workers/service";

const app = new Hono<{ Bindings: Env }>();
app.route("/", share);
app.route("/", api);

export default { fetch: app.fetch } satisfies ExportedHandler<Env>;
