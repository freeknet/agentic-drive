import PlayArrowRoundedIcon from "@mui/icons-material/PlayArrowRounded";
import Box from "@mui/material/Box";
import { type ReactNode, useState } from "react";
import { contentUrl, type Item } from "~/lib/api";

const IMAGE_EXT = /\.(png|jpe?g|gif|webp|avif|bmp|ico|heic|heif)$/i;
const VIDEO_EXT = /\.(mp4|m4v|webm|mov|ogv)$/i;
/** Full images are loaded as thumbnails (no server-side resizing on Workers Free), so skip huge ones. */
const MAX_IMAGE_BYTES = 30 * 1024 * 1024;

/** What kind of preview a file can have: an image, a video frame, or none. */
export function thumbKind(item: Pick<Item, "kind" | "mime" | "name" | "size" | "trashed_at">): "image" | "video" | null {
	if (item.kind !== "file" || item.trashed_at) return null;
	const mime = (item.mime ?? "").toLowerCase();
	// SVG can carry script, so it's never shown inline.
	if (mime === "image/svg+xml" || /\.svg$/i.test(item.name)) return null;
	const generic = !mime || mime === "application/octet-stream";
	if (mime.startsWith("image/") || (generic && IMAGE_EXT.test(item.name))) return item.size <= MAX_IMAGE_BYTES ? "image" : null;
	if (mime.startsWith("video/") || (generic && VIDEO_EXT.test(item.name))) return "video";
	return null;
}

/**
 * A file's preview: the picture itself, or a video's first second with a
 * play badge. Fades in once loaded; anything the browser can't decode (HEIC
 * in Chrome, a damaged file) falls back to `fallback`, usually the type icon.
 */
export function Thumbnail({ item, fit = "cover", fallback }: { item: Item; fit?: "cover" | "contain"; fallback: ReactNode }) {
	const kind = thumbKind(item);
	const [state, setState] = useState<"loading" | "ok" | "failed">("loading");
	if (!kind || state === "failed") return <>{fallback}</>;
	const src = contentUrl(item.id);
	const media = {
		width: 1,
		height: 1,
		objectFit: fit,
		display: "block",
		opacity: state === "ok" ? 1 : 0,
		transition: "opacity .25s ease",
	} as const;
	return (
		<Box sx={{ position: "relative", width: 1, height: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
			{state === "loading" && <Box sx={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>{fallback}</Box>}
			{kind === "image" ? (
				<Box
					component="img"
					src={src}
					alt=""
					loading="lazy"
					decoding="async"
					draggable={false}
					// A cached image can finish before React is listening; catch that too.
					ref={(el: HTMLImageElement | null) => {
						if (el?.complete && state === "loading") setState(el.naturalWidth > 0 ? "ok" : "failed");
					}}
					onLoad={() => setState("ok")}
					onError={() => setState("failed")}
					sx={media}
				/>
			) : (
				<>
					{/* #t=1 asks for the frame at one second; only the metadata and that frame are fetched (Range). */}
					<Box
						component="video"
						src={`${src}#t=1`}
						preload="metadata"
						muted
						playsInline
						onLoadedData={() => setState("ok")}
						onError={() => setState("failed")}
						sx={{ ...media, pointerEvents: "none" }}
					/>
					{state === "ok" && (
						<Box
							sx={{
								position: "absolute",
								width: 40,
								height: 40,
								borderRadius: "50%",
								bgcolor: "rgba(0,0,0,.55)",
								color: "#fff",
								display: "flex",
								alignItems: "center",
								justifyContent: "center",
							}}
						>
							<PlayArrowRoundedIcon />
						</Box>
					)}
				</>
			)}
		</Box>
	);
}
