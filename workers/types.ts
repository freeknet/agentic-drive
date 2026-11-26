export interface Env extends Cloudflare.Env {
	// TEAM_DOMAIN, POLICY_AUD and PUBLIC_URL come from wrangler.jsonc vars.
}

export function driveStub(env: Env) {
	return env.DRIVE.get(env.DRIVE.idFromName("drive"));
}
