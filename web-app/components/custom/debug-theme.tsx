"use client";

import { useTheme } from "next-themes";
import { useEffect, useState } from "react";

export function DebugTheme() {
	const [mounted, setMounted] = useState(false);
	const [htmlClass, setHtmlClass] = useState("");
	const [cssVars, setCssVars] = useState({ bg: "", fg: "", primary: "" });
	const { theme, resolvedTheme } = useTheme();

	useEffect(() => {
		setMounted(true);
	}, []);

	useEffect(() => {
		if (mounted) {
			setHtmlClass(document.documentElement.className);
			const styles = getComputedStyle(document.documentElement);
			setCssVars({
				bg: styles.getPropertyValue("--background"),
				fg: styles.getPropertyValue("--foreground"),
				primary: styles.getPropertyValue("--primary"),
			});
		}
	}, [mounted, theme, resolvedTheme]);

	if (!mounted) return null;

	return (
		<div className="fixed bottom-4 right-4 bg-card text-card-foreground p-4 rounded-lg shadow-lg border text-xs space-y-1 max-w-xs">
			<div className="font-bold">Theme Debug</div>
			<div>theme: {theme}</div>
			<div>resolvedTheme: {resolvedTheme}</div>
			<div>html class: {htmlClass || "(none)"}</div>
			<div>--background: {cssVars.bg}</div>
			<div>--foreground: {cssVars.fg}</div>
			<div>--primary: {cssVars.primary}</div>
		</div>
	);
}
