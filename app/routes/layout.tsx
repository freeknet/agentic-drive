import { Button, DropdownMenu, Input } from "@cloudflare/kumo";
import {
	CircleHalfIcon,
	FolderPlusIcon,
	HardDrivesIcon,
	MagnifyingGlassIcon,
	MoonIcon,
	PlusIcon,
	SunIcon,
	TrashIcon,
	UploadSimpleIcon,
} from "@phosphor-icons/react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate, useParams, useSearchParams } from "react-router";
import { ActionsProvider, useActions } from "~/components/actions";
import { AppSwitcher } from "~/components/AppSwitcher";
import { UploadPanel } from "~/components/UploadPanel";
import { useTheme } from "~/hooks/useTheme";
import { api } from "~/lib/api";
import { formatBytes } from "~/lib/format";
import { enqueue, onUploaded } from "~/lib/uploads";

function StorageMeter() {
	const { data } = useQuery({ queryKey: ["stats"], queryFn: api.stats });
	if (!data) return null;
	const pct = Math.min(100, (data.bytes / data.limit) * 100);
	const color = pct > 90 ? "bg-kumo-danger" : pct > 75 ? "bg-kumo-warning" : "bg-kumo-brand";
	return (
		<div className="px-3 text-xs text-kumo-subtle">
			<div className="h-1.5 overflow-hidden rounded-full bg-kumo-fill" role="meter" aria-label="Storage used" aria-valuenow={data.bytes} aria-valuemin={0} aria-valuemax={data.limit}>
				<div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
			</div>
			<div className="mt-1.5">
				{formatBytes(data.bytes)} of {formatBytes(data.limit)} free tier
			</div>
			{data.trashBytes > 0 && <div>{formatBytes(data.trashBytes)} in the trash</div>}
		</div>
	);
}

function NewMenu({ folderId }: { folderId: string | null }) {
	const a = useActions();
	const fileInput = useRef<HTMLInputElement>(null);
	return (
		<>
			<input
				ref={fileInput}
				type="file"
				multiple
				hidden
				onChange={(e) => {
					if (e.target.files?.length) enqueue(e.target.files, folderId);
					e.target.value = "";
				}}
			/>
			<DropdownMenu>
				<DropdownMenu.Trigger render={<Button variant="primary" icon={<PlusIcon size={16} weight="bold" />}>New</Button>} />
				<DropdownMenu.Content align="start">
					<DropdownMenu.Item icon={UploadSimpleIcon} onClick={() => fileInput.current?.click()}>
						Upload files
					</DropdownMenu.Item>
					<DropdownMenu.Item icon={FolderPlusIcon} onClick={() => a.newFolder(folderId)}>
						New folder
					</DropdownMenu.Item>
				</DropdownMenu.Content>
			</DropdownMenu>
		</>
	);
}

const navClass = ({ isActive }: { isActive: boolean }) =>
	`flex items-center gap-2 rounded-lg px-3 py-2 text-sm ${isActive ? "bg-kumo-tint font-medium text-kumo-default" : "text-kumo-subtle hover:bg-kumo-tint hover:text-kumo-default"}`;

function Shell() {
	const { folderId = null } = useParams();
	const location = useLocation();
	const navigate = useNavigate();
	const [params] = useSearchParams();
	const [q, setQ] = useState(params.get("q") ?? "");
	const { preference, cycle } = useTheme();
	const qc = useQueryClient();
	const [dragging, setDragging] = useState(false);
	const inTrash = location.pathname.startsWith("/trash");
	const canDrop = !inTrash && !location.pathname.startsWith("/search");

	useEffect(() => {
		const off = onUploaded(() => void qc.invalidateQueries());
		return () => {
			off();
		};
	}, [qc]);

	// Drop files anywhere on a folder view to upload them there.
	useEffect(() => {
		let depth = 0;
		const hasFiles = (e: DragEvent) => !!e.dataTransfer?.types.includes("Files");
		const enter = (e: DragEvent) => {
			if (!hasFiles(e) || !canDrop) return;
			depth++;
			setDragging(true);
		};
		const leave = () => {
			depth = Math.max(0, depth - 1);
			if (depth === 0) setDragging(false);
		};
		const over = (e: DragEvent) => {
			if (hasFiles(e) && canDrop) e.preventDefault();
		};
		const drop = (e: DragEvent) => {
			if (!hasFiles(e) || !canDrop) return;
			e.preventDefault();
			depth = 0;
			setDragging(false);
			const files = [...(e.dataTransfer?.files ?? [])].filter((f) => f.size > 0 || f.type);
			if (files.length) enqueue(files, folderId);
		};
		window.addEventListener("dragenter", enter);
		window.addEventListener("dragleave", leave);
		window.addEventListener("dragover", over);
		window.addEventListener("drop", drop);
		return () => {
			window.removeEventListener("dragenter", enter);
			window.removeEventListener("dragleave", leave);
			window.removeEventListener("dragover", over);
			window.removeEventListener("drop", drop);
		};
	}, [folderId, canDrop]);

	const ThemeIcon = preference === "dark" ? MoonIcon : preference === "light" ? SunIcon : CircleHalfIcon;

	return (
		<div className="flex h-dvh flex-col">
			<header className="flex items-center gap-3 border-b border-kumo-line bg-kumo-base px-4 py-2">
				<NavLink to="/" className="flex shrink-0 items-center gap-2 font-semibold">
					<HardDrivesIcon size={24} weight="duotone" className="text-kumo-brand" />
					<span className="hidden sm:inline">Drive</span>
				</NavLink>
				<form
					className="relative mx-auto w-full max-w-xl"
					onSubmit={(e) => {
						e.preventDefault();
						if (q.trim()) navigate(`/search?q=${encodeURIComponent(q.trim())}`);
					}}
				>
					<MagnifyingGlassIcon size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-kumo-subtle" />
					<Input aria-label="Search Drive" placeholder="Search Drive" value={q} onChange={(e) => setQ(e.target.value)} className="w-full pl-9" />
				</form>
				<AppSwitcher />
				<Button variant="ghost" shape="square" icon={<ThemeIcon size={20} />} aria-label={`Theme: ${preference} (click to change)`} onClick={cycle} />
			</header>
			<div className="flex min-h-0 flex-1">
				<aside className="hidden w-60 shrink-0 flex-col gap-4 border-r border-kumo-line bg-kumo-base py-4 md:flex">
					<div className="px-3">{!inTrash && <NewMenu folderId={folderId} />}</div>
					<nav className="flex flex-col gap-0.5 px-2" aria-label="Drive sections">
						<NavLink to="/" end className={({ isActive }) => navClass({ isActive: isActive || location.pathname.startsWith("/folder/") })}>
							<HardDrivesIcon size={18} /> My Drive
						</NavLink>
						<NavLink to="/trash" className={navClass}>
							<TrashIcon size={18} /> Trash
						</NavLink>
					</nav>
					<div className="mt-auto">
						<StorageMeter />
					</div>
				</aside>
				<main className="relative min-w-0 flex-1 overflow-y-auto px-4 py-4 md:px-8">
					<nav className="mb-3 flex items-center gap-2 md:hidden" aria-label="Drive sections">
						{!inTrash && <NewMenu folderId={folderId} />}
						<NavLink to="/" end className={navClass}>
							My Drive
						</NavLink>
						<NavLink to="/trash" className={navClass}>
							Trash
						</NavLink>
					</nav>
					<Outlet />
				</main>
			</div>
			{dragging && (
				<div className="pointer-events-none fixed inset-0 z-30 flex items-center justify-center bg-kumo-brand/10 outline-4 -outline-offset-8 outline-dashed outline-kumo-brand">
					<div className="rounded-xl bg-kumo-base px-6 py-4 text-sm font-medium shadow-lg">Drop to upload here</div>
				</div>
			)}
			<UploadPanel />
		</div>
	);
}

export default function Layout() {
	return (
		<ActionsProvider>
			<Shell />
		</ActionsProvider>
	);
}
