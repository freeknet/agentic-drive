import { Hono } from "hono";
import { createRemoteJWKSet, jwtVerify, type JWTPayload } from "jose";
import { createContext, createRequestHandler, RouterContextProvider } from "react-router";
import { identify } from "./access";
import { api } from "./api";
import { sameOriginOnly } from "./same-origin";
import { share } from "./share";
import type { Env } from "./types";

export { DriveDO } from "./drive-do";
export { DriveService } from "./service";

export const cloudflareContext = createContext<{ env: Env; ctx: ExecutionContext }>();

const requestHandler = createRequestHandler(() => import("virtual:react-router/server-build"), import.meta.env.MODE);

const jwksCache = new Map<string, ReturnType<typeof createRemoteJWKSet>>();
function jwksFor(teamDomain: string) {
	const issuer = new URL(teamDomain).origin;
	const certs = new URL("/cdn-cgi/access/certs", issuer);
	let jwks = jwksCache.get(certs.href);
	if (!jwks) {
		jwks = createRemoteJWKSet(certs);
		jwksCache.set(certs.href, jwks);
	}
	return { issuer, jwks };
}

/** Share links are public (an Access Bypass app covers /s); the token is the credential. */
export function isPublicPath(path: string): boolean {
	return path.startsWith("/s/");
}

const app = new Hono<{ Bindings: Env }>();

// Cloudflare Access: only a signed-in person (not a service token) may use the app.
app.use("*", async (c, next) => {
	if (import.meta.env.DEV || isPublicPath(c.req.path)) return next();
	const { POLICY_AUD, TEAM_DOMAIN } = c.env;
	if (!POLICY_AUD || !TEAM_DOMAIN) {
		return c.text("Cloudflare Access must be configured in production. Set POLICY_AUD and TEAM_DOMAIN.", 500);
	}
	const token = c.req.header("cf-access-jwt-assertion");
	if (!token) return c.text("Missing required CF Access JWT", 403);
	let payload: JWTPayload;
	try {
		const { issuer, jwks } = jwksFor(TEAM_DOMAIN);
		({ payload } = await jwtVerify(token, jwks, { issuer, audience: POLICY_AUD }));
	} catch {
		return c.text("Invalid or expired Access token", 403);
	}
	if (identify(payload).kind !== "user") return c.text("This Access identity may not use this app", 403);
	return next();
});

// CSRF: refuse cross-site writes anywhere in the app (api.ts repeats this so
// the API is covered on its own too).
app.use("*", sameOriginOnly);

app.route("/", share);
app.route("/", api);

app.all("*", (c) => {
	const context = new RouterContextProvider();
	context.set(cloudflareContext, { env: c.env, ctx: c.executionCtx as ExecutionContext });
	return requestHandler(c.req.raw, context);
});

export default { fetch: app.fetch } satisfies ExportedHandler<Env>;
