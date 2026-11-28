import { create } from "zustand";
import { persist } from "zustand/middleware";

export type Accent = "blue" | "teal" | "green" | "amber" | "orange" | "red" | "pink" | "purple";
export type Density = "comfortable" | "compact";
export type FontSize = "small" | "medium" | "large";
export type DefaultView = "list" | "grid";

export const ACCENTS: Record<Accent, { label: string; light: string; lightSoft: string; dark: string; darkSoft: string }> = {
	blue: { label: "Blue", light: "#0b57d0", lightSoft: "#d3e3fd", dark: "#a8c7fa", darkSoft: "#004a77" },
	green: { label: "Green", light: "#1a7f45", lightSoft: "#d7f0e0", dark: "#8fd6a8", darkSoft: "#00402a" },
	purple: { label: "Purple", light: "#6b3fc4", lightSoft: "#e7dcfb", dark: "#c9b2f7", darkSoft: "#2b1a4d" },
	amber: { label: "Amber", light: "#9a5b00", lightSoft: "#fbe6c8", dark: "#fdd663", darkSoft: "#4a3200" },
	red: { label: "Red", light: "#b3261e", lightSoft: "#fadbd8", dark: "#f2b8b5", darkSoft: "#4d1f1c" },
	teal: { label: "Teal", light: "#00696f", lightSoft: "#c5eef0", dark: "#6fd8e0", darkSoft: "#004f53" },
	orange: { label: "Orange", light: "#b3470b", lightSoft: "#ffdbc8", dark: "#ffb68d", darkSoft: "#5c2300" },
	pink: { label: "Pink", light: "#b0186f", lightSoft: "#ffd8ea", dark: "#ffafd3", darkSoft: "#5e0039" },
};

export const FONT_SIZES: Record<FontSize, { label: string; root: string }> = {
	small: { label: "Small", root: "14px" },
	medium: { label: "Medium", root: "16px" },
	large: { label: "Large", root: "18px" },
};

interface Prefs {
	accent: Accent;
	density: Density;
	fontSize: FontSize;
	defaultView: DefaultView;
	confirmTrash: boolean;
	set: <K extends keyof Prefs>(key: K, value: Prefs[K]) => void;
	reset: () => void;
}

export const DEFAULT_PREFS = {
	accent: "blue" as Accent,
	density: "comfortable" as Density,
	fontSize: "medium" as FontSize,
	defaultView: "list" as DefaultView,
	confirmTrash: true,
};

export const usePrefs = create<Prefs>()(
	persist(
		(set) => ({
			...DEFAULT_PREFS,
			set: (key, value) => set({ [key]: value } as Partial<Prefs>),
			reset: () => set({ ...DEFAULT_PREFS }),
		}),
		{
			name: "drive-prefs",
			// Loaded in an effect (PreferencesApplier), so the first browser render
			// matches the server's, which only knows the defaults.
			skipHydration: true,
		},
	),
);
