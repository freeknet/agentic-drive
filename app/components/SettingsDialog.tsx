import RestartAltIcon from "@mui/icons-material/RestartAlt";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import Divider from "@mui/material/Divider";
import FormControlLabel from "@mui/material/FormControlLabel";
import MenuItem from "@mui/material/MenuItem";
import Switch from "@mui/material/Switch";
import TextField from "@mui/material/TextField";
import ToggleButton from "@mui/material/ToggleButton";
import ToggleButtonGroup from "@mui/material/ToggleButtonGroup";
import Typography from "@mui/material/Typography";
import { ACCENTS, FONT_SIZES, usePrefs, type Accent, type DefaultView, type Density, type FontSize } from "~/lib/prefs";

const caption = { display: "block", mb: 0.75 } as const;

/** Appearance and behaviour settings, stored in this browser. */
export function SettingsDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
	const prefs = usePrefs();

	return (
		<Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
			<DialogTitle>Settings</DialogTitle>
			<DialogContent dividers>
				<Typography variant="subtitle2" sx={{ mb: 1.5 }}>
					Appearance
				</Typography>

				<Typography variant="caption" color="text.secondary" sx={caption}>
					Accent colour
				</Typography>
				<ToggleButtonGroup
					exclusive
					size="small"
					value={prefs.accent}
					onChange={(_, v: Accent | null) => v && prefs.set("accent", v)}
					aria-label="Accent colour"
					sx={{ mb: 2.5, flexWrap: "wrap" }}
				>
					{(Object.keys(ACCENTS) as Accent[]).map((key) => (
						<ToggleButton key={key} value={key} aria-label={ACCENTS[key].label} sx={{ gap: 0.75, px: 1.5 }}>
							<Box sx={{ width: 14, height: 14, borderRadius: "50%", bgcolor: ACCENTS[key].light }} />
							{ACCENTS[key].label}
						</ToggleButton>
					))}
				</ToggleButtonGroup>

				<Box sx={{ display: "grid", gap: 2, gridTemplateColumns: { sm: "1fr 1fr" }, mb: 2 }}>
					<Box>
						<Typography variant="caption" color="text.secondary" sx={caption}>
							Row density
						</Typography>
						<ToggleButtonGroup
							exclusive
							fullWidth
							size="small"
							value={prefs.density}
							onChange={(_, v: Density | null) => v && prefs.set("density", v)}
						>
							<ToggleButton value="comfortable">Comfortable</ToggleButton>
							<ToggleButton value="compact">Compact</ToggleButton>
						</ToggleButtonGroup>
					</Box>
					<TextField
						select
						label="Text size"
						size="small"
						value={prefs.fontSize}
						onChange={(e) => prefs.set("fontSize", e.target.value as FontSize)}
					>
						{(Object.keys(FONT_SIZES) as FontSize[]).map((key) => (
							<MenuItem key={key} value={key}>
								{FONT_SIZES[key].label}
							</MenuItem>
						))}
					</TextField>
				</Box>

				<TextField
					select
					fullWidth
					size="small"
					label="Default view"
					value={prefs.defaultView}
					onChange={(e) => prefs.set("defaultView", e.target.value as DefaultView)}
					sx={{ mb: 2.5 }}
				>
					<MenuItem value="list">List</MenuItem>
					<MenuItem value="grid">Grid</MenuItem>
				</TextField>

				<Divider sx={{ mb: 2 }} />

				<Typography variant="subtitle2" sx={{ mb: 1 }}>
					Behaviour
				</Typography>
				<FormControlLabel
					control={
						<Switch
							size="small"
							checked={prefs.confirmTrash}
							onChange={(e) => prefs.set("confirmTrash", e.target.checked)}
						/>
					}
					label={<Typography variant="body2">Ask before moving items to the trash</Typography>}
					sx={{ ml: 0, mb: 1 }}
				/>
				<Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 2 }}>
					Delete forever always asks. Grid or list can also be switched in the toolbar at any time.
				</Typography>

				<Button size="small" startIcon={<RestartAltIcon fontSize="small" />} onClick={prefs.reset}>
					Reset to defaults
				</Button>
			</DialogContent>
		</Dialog>
	);
}
