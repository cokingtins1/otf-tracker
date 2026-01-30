import ThemeSwitch from "@/components/custom/theme-switch";
import { Button } from "@/components/ui/button";
import Link from "next/link";

export default function Home() {
	return (
		<div className="min-h-screen flex flex-col items-center justify-center p-8">
			<div className="max-w-2xl w-full space-y-8 text-center">
				<div className="space-y-4">
					<h1 className="text-5xl font-bold tracking-tight">
						OTF Workout Tracker
					</h1>
					<p className="text-xl text-muted-foreground">
						Track your OrangeTheory Fitness workouts by connecting your Gmail account
					</p>
				</div>

				<div className="space-y-4">
					<Link href="/api/auth/google">
						<Button size="lg" className="text-lg px-8 py-6">
							Connect Gmail Account
						</Button>
					</Link>

					<p className="text-sm text-muted-foreground">
						Securely connect to fetch workout data from emails labeled &quot;OTF&quot;
					</p>
				</div>

				<div className="absolute top-4 right-4">
					<ThemeSwitch />
				</div>
			</div>
		</div>
	);
}
