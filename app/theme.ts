import { createTheme } from "@mui/material/styles";

/**
 * Material Design 3 flavoured theme with light and dark schemes as CSS
 * variables, switched by a class on <html> (set before paint by
 * InitColorSchemeScript, so there is no flash of the wrong scheme).
 */
export const theme = createTheme({
	cssVariables: { colorSchemeSelector: "class" },
	colorSchemes: {
		light: {
			palette: {
				primary: { main: "#0b57d0", light: "#d3e3fd", contrastText: "#ffffff" },
				secondary: { main: "#c2e7ff", contrastText: "#001d35" },
				background: { default: "#f8fafd", paper: "#ffffff" },
				text: { primary: "#1f1f1f", secondary: "#444746" },
				divider: "#e1e3e1",
				action: { hover: "rgba(68,71,70,0.08)", selected: "#c2e7ff" },
			},
		},
		dark: {
			palette: {
				primary: { main: "#a8c7fa", light: "#004a77", contrastText: "#062e6f" },
				secondary: { main: "#004a77", contrastText: "#c2e7ff" },
				background: { default: "#1b1b1b", paper: "#131314" },
				text: { primary: "#e3e3e3", secondary: "#c4c7c5" },
				divider: "#444746",
				action: { hover: "rgba(227,227,227,0.08)", selected: "#004a77" },
			},
		},
	},
	shape: { borderRadius: 12 },
	typography: {
		fontFamily: '"Google Sans", "Roboto", "Segoe UI", system-ui, -apple-system, sans-serif',
		button: { textTransform: "none", fontWeight: 500 },
		h6: { fontWeight: 400, fontSize: "1.375rem" },
	},
	components: {
		MuiButton: {
			defaultProps: { disableElevation: true },
			styleOverrides: { root: { borderRadius: 999, paddingInline: 16 } },
		},
		MuiToggleButton: { styleOverrides: { root: { borderRadius: 999, textTransform: "none" } } },
		MuiToggleButtonGroup: { styleOverrides: { root: { borderRadius: 999 } } },
		MuiMenu: { defaultProps: { slotProps: { paper: { elevation: 3 } } } },
		MuiMenuItem: { styleOverrides: { root: { minHeight: 40, gap: 4 } } },
		MuiDialog: { styleOverrides: { paper: { borderRadius: 28 } } },
		MuiListItemButton: { styleOverrides: { root: { borderRadius: 999 } } },
		MuiTooltip: { defaultProps: { enterDelay: 400 } },
		MuiCard: { defaultProps: { variant: "outlined" } },
		MuiChip: { styleOverrides: { root: { borderRadius: 8 } } },
	},
});
