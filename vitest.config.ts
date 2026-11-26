import { cloudflareTest } from "@cloudflare/vitest-plugin";
import { defineConfig } from "vitest/config";

export default defineConfig({
	resolve: { tsconfigPaths: true },
	plugins: [
		cloudflareTest({
			wrangler: { configPath: "./wrangler.jsonc" },
			// workers/app.ts needs the React Router virtual module; see test/worker-entry.ts.
			main: "./test/worker-entry.ts",
			remoteBindings: false,
			miniflare: {
				bindings: { PUBLIC_URL: "https://drive.example.com", MAIL_URL: "https://mail.example.com" },
			},
		}),
	],
	test: {
		include: ["test/**/*.test.ts"],
		setupFiles: ["./test/setup.ts"],
	},
});
