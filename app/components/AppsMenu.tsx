import IconButton from "@mui/material/IconButton";
import Paper from "@mui/material/Paper";
import Popover from "@mui/material/Popover";
import Stack from "@mui/material/Stack";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import AddToDriveIcon from "@mui/icons-material/AddToDrive";
import AppsIcon from "@mui/icons-material/Apps";
import MailIcon from "@mui/icons-material/Mail";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { api } from "~/lib/api";

/**
 * Apps launcher (the 3×3 grid button), mirrored in agentic-inbox. Both apps
 * sit behind the same Cloudflare Access team, so switching needs no second
 * sign-in. Hidden when MAIL_URL isn't set.
 */
export function AppsMenu() {
	const [anchor, setAnchor] = useState<HTMLElement | null>(null);
	const { data } = useQuery({ queryKey: ["config"], queryFn: api.config, staleTime: Number.POSITIVE_INFINITY });
	if (!data?.mailUrl) return null;
	const apps = [
		{ name: "Mail", href: data.mailUrl, icon: <MailIcon sx={{ fontSize: 36, color: "#ea4335" }} />, current: false },
		{ name: "Drive", href: "/", icon: <AddToDriveIcon sx={{ fontSize: 36, color: "#1a73e8" }} />, current: true },
	];
	return (
		<>
			<Tooltip title="Apps">
				<IconButton aria-label="Apps" aria-haspopup="true" onClick={(e) => setAnchor(e.currentTarget)}>
					<AppsIcon />
				</IconButton>
			</Tooltip>
			<Popover
				open={!!anchor}
				anchorEl={anchor}
				onClose={() => setAnchor(null)}
				anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
				transformOrigin={{ vertical: "top", horizontal: "right" }}
				slotProps={{ paper: { sx: { borderRadius: 4, p: 1.5, bgcolor: "background.default" } } }}
			>
				<Paper sx={{ p: 1, borderRadius: 3, display: "grid", gridTemplateColumns: "repeat(2, 96px)", gap: 0.5 }}>
					{apps.map((a) => (
						<Stack
							key={a.name}
							component="a"
							href={a.href}
							aria-current={a.current ? "page" : undefined}
							spacing={0.5}
							sx={{ alignItems: "center", py: 1.5, borderRadius: 3, textDecoration: "none", color: "text.primary", bgcolor: a.current ? "action.selected" : undefined, "&:hover": { bgcolor: "action.hover" } }}
						>
							{a.icon}
							<Typography variant="body2">{a.name}</Typography>
						</Stack>
					))}
				</Paper>
			</Popover>
		</>
	);
}
