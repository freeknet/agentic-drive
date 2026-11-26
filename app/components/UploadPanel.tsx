import { Button } from "@cloudflare/kumo";
import { CaretDownIcon, CaretUpIcon, CheckCircleIcon, WarningCircleIcon, XIcon } from "@phosphor-icons/react";
import { useState } from "react";
import { formatBytes } from "~/lib/format";
import { cancel, clearFinished, useUploads } from "~/lib/uploads";

export function UploadPanel() {
	const uploads = useUploads();
	const [collapsed, setCollapsed] = useState(false);
	if (uploads.length === 0) return null;

	const active = uploads.filter((u) => u.state === "queued" || u.state === "uploading").length;
	const done = uploads.filter((u) => u.state === "done").length;
	const failed = uploads.filter((u) => u.state === "error").length;
	const title = active
		? `Uploading ${active} file${active === 1 ? "" : "s"}`
		: failed
			? `${failed} upload${failed === 1 ? "" : "s"} failed`
			: `${done} upload${done === 1 ? "" : "s"} complete`;

	return (
		<div className="fixed bottom-4 right-4 z-40 w-[min(360px,calc(100vw-2rem))] overflow-hidden rounded-xl border border-kumo-line bg-kumo-base shadow-lg">
			<div className="flex items-center gap-1 border-b border-kumo-line px-3 py-2">
				<span className="flex-1 text-sm font-medium" role="status">
					{title}
				</span>
				<Button
					variant="ghost"
					shape="square"
					size="sm"
					icon={collapsed ? <CaretUpIcon size={16} /> : <CaretDownIcon size={16} />}
					aria-label={collapsed ? "Show uploads" : "Hide uploads"}
					onClick={() => setCollapsed(!collapsed)}
				/>
				{!active && <Button variant="ghost" shape="square" size="sm" icon={<XIcon size={16} />} aria-label="Close" onClick={clearFinished} />}
			</div>
			{!collapsed && (
				<ul className="max-h-64 overflow-y-auto">
					{uploads.map((u) => {
						const pct = u.size ? Math.round((u.sent / u.size) * 100) : 100;
						return (
							<li key={u.key} className="border-b border-kumo-line px-3 py-2 last:border-b-0">
								<div className="flex items-center gap-2">
									<span className="min-w-0 flex-1 truncate text-sm">{u.name}</span>
									{u.state === "done" && <CheckCircleIcon size={18} weight="fill" className="text-kumo-success" />}
									{u.state === "error" && <WarningCircleIcon size={18} weight="fill" className="text-kumo-danger" />}
									{(u.state === "queued" || u.state === "uploading") && (
										<Button variant="ghost" shape="square" size="sm" icon={<XIcon size={14} />} aria-label={`Cancel ${u.name}`} onClick={() => cancel(u.key)} />
									)}
								</div>
								{u.state === "uploading" && (
									<>
										<div className="mt-1 h-1.5 overflow-hidden rounded-full bg-kumo-fill">
											<div className="h-full rounded-full bg-kumo-brand transition-[width]" style={{ width: `${pct}%` }} />
										</div>
										<div className="mt-0.5 text-xs text-kumo-subtle">
											{formatBytes(u.sent)} of {formatBytes(u.size)}
										</div>
									</>
								)}
								{u.state === "queued" && <div className="text-xs text-kumo-subtle">Waiting…</div>}
								{u.state === "cancelled" && <div className="text-xs text-kumo-subtle">Cancelled</div>}
								{u.state === "error" && <div className="text-xs text-kumo-danger">{u.error}</div>}
							</li>
						);
					})}
				</ul>
			)}
		</div>
	);
}
