import { useEffect } from "react";
import { ACCENTS, FONT_SIZES, usePrefs } from "~/lib/prefs";

/** Writes appearance preferences to the document as CSS variables. */
export default function PreferencesApplier() {
	const accent = usePrefs((p) => p.accent);
	const fontSize = usePrefs((p) => p.fontSize);
	const density = usePrefs((p) => p.density);

	useEffect(() => {
		const root = document.documentElement;
		const palette = ACCENTS[accent] ?? ACCENTS.blue;
		root.style.setProperty("--app-accent", palette.light);
		root.style.setProperty("--app-accent-soft", palette.lightSoft);
		root.style.setProperty("--app-accent-dark", palette.dark);
		root.style.setProperty("--app-accent-dark-soft", palette.darkSoft);
		root.dataset.accent = accent;
		root.dataset.density = density;
		root.style.fontSize = FONT_SIZES[fontSize]?.root ?? "16px";
	}, [accent, fontSize, density]);

	return (
		<style>{`
			html.light {
				--mui-palette-primary-main: var(--app-accent);
				--mui-palette-primary-light: var(--app-accent-soft);
				--mui-palette-primary-contrastText: #ffffff;
			}
			html.dark {
				--mui-palette-primary-main: var(--app-accent-dark);
				--mui-palette-primary-light: var(--app-accent-dark-soft);
				--mui-palette-primary-contrastText: #062e6f;
			}
		`}</style>
	);
}
