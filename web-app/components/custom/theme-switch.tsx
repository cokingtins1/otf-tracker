"use client";

import * as React from "react";
import { useTheme } from "next-themes";
import { Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function ThemeSwitch() {
	const [mounted, setMounted] = React.useState(false);
	const { resolvedTheme, setTheme } = useTheme();

	// Avoid hydration mismatch
	React.useEffect(() => {
		setMounted(true);
	}, []);

	if (!mounted) {
		return (
			<Button variant="outline" size="sm" className="gap-2 w-[88px]">
				<div className="h-4 w-4" />
			</Button>
		);
	}

	const isLight = resolvedTheme === "light";

	return (
		<Button
			variant="outline"
			size="sm"
			onClick={() => setTheme(isLight ? "dark" : "light")}
			className="gap-2"
		>
			{isLight ? (
				<>
					<Moon className="h-4 w-4 text-primary" />
					Dark
				</>
			) : (
				<>
					<Sun className="h-4 w-4 text-primary" />
					Light
				</>
			)}
		</Button>
	);
}
