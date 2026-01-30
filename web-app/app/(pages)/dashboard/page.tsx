"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import ThemeSwitch from "@/components/custom/theme-switch";

interface SyncResult {
	success: boolean;
	newWorkouts: number;
	skippedWorkouts: number;
	errors?: number;
	totalProcessed: number;
	error?: string;
	details?: string;
}

export default function Dashboard() {
	const [syncing, setSyncing] = useState(false);
	const [syncResult, setSyncResult] = useState<SyncResult | null>(null);

	async function handleSync() {
		setSyncing(true);
		setSyncResult(null);

		try {
			const response = await fetch("/api/gmail/sync", {
				method: "POST",
			});

			const data = await response.json();

			if (!response.ok) {
				setSyncResult({
					success: false,
					newWorkouts: 0,
					skippedWorkouts: 0,
					totalProcessed: 0,
					error: data.error,
					details: data.details,
				});
			} else {
				setSyncResult(data);
			}
		} catch (error) {
			setSyncResult({
				success: false,
				newWorkouts: 0,
				skippedWorkouts: 0,
				totalProcessed: 0,
				error: "Failed to sync workouts",
				details:
					error instanceof Error ? error.message : "Unknown error",
			});
		} finally {
			setSyncing(false);
		}
	}

	return (
		<div className="min-h-screen p-8">
			<div className="max-w-4xl mx-auto space-y-8">
				<div className="flex items-center justify-between">
					<div>
						<h1 className="text-4xl font-bold">
							OTF Workout Dashboard
						</h1>
						<p className="text-muted-foreground mt-2">
							Sync your OrangeTheory workout data from Gmail
						</p>
					</div>
					<ThemeSwitch />
				</div>

				<div className="space-y-4">
					<Button
						onClick={handleSync}
						disabled={syncing}
						size="lg"
						className="w-full sm:w-auto"
					>
						{syncing ? "Syncing..." : "Sync Workouts from Gmail"}
					</Button>

					{syncResult && (
						<div
							className={`p-6 rounded-lg border ${
								syncResult.success
									? "bg-green-50 dark:bg-green-950 border-green-200 dark:border-green-800"
									: "bg-red-50 dark:bg-red-950 border-red-200 dark:border-red-800"
							}`}
						>
							{syncResult.success ? (
								<div className="space-y-2">
									<h3 className="text-lg font-semibold text-green-900 dark:text-green-100">
										Sync Completed Successfully
									</h3>
									<div className="grid grid-cols-2 gap-4 text-sm">
										<div>
											<p className="text-green-700 dark:text-green-300 font-medium">
												New Workouts
											</p>
											<p className="text-2xl font-bold text-green-900 dark:text-green-100">
												{syncResult.newWorkouts}
											</p>
										</div>
										<div>
											<p className="text-green-700 dark:text-green-300 font-medium">
												Already Synced
											</p>
											<p className="text-2xl font-bold text-green-900 dark:text-green-100">
												{syncResult.skippedWorkouts}
											</p>
										</div>
										<div>
											<p className="text-green-700 dark:text-green-300 font-medium">
												Total Processed
											</p>
											<p className="text-2xl font-bold text-green-900 dark:text-green-100">
												{syncResult.totalProcessed}
											</p>
										</div>
										{syncResult.errors !== undefined &&
											syncResult.errors > 0 && (
												<div>
													<p className="text-orange-700 dark:text-orange-300 font-medium">
														Errors
													</p>
													<p className="text-2xl font-bold text-orange-900 dark:text-orange-100">
														{syncResult.errors}
													</p>
												</div>
											)}
									</div>
								</div>
							) : (
								<div className="space-y-2">
									<h3 className="text-lg font-semibold text-red-900 dark:text-red-100">
										Sync Failed
									</h3>
									<p className="text-red-700 dark:text-red-300">
										{syncResult.error}
									</p>
									{syncResult.details && (
										<p className="text-sm text-red-600 dark:text-red-400">
											Details: {syncResult.details}
										</p>
									)}
								</div>
							)}
						</div>
					)}
				</div>

				<div className="rounded-lg border p-6 space-y-4">
					<h2 className="text-2xl font-semibold">How It Works</h2>
					<ol className="list-decimal list-inside space-y-2 text-muted-foreground">
						<li>
							Ensure your OrangeTheory workout emails are labeled
							&quot;OTF&quot; in Gmail
						</li>
						<li>
							Click &quot;Sync Workouts from Gmail&quot; to fetch new
							workout data
						</li>
						<li>
							The app will parse and store your workout metrics
							automatically
						</li>
						<li>
							View your workout history and analytics (coming
							soon)
						</li>
					</ol>
				</div>
			</div>
		</div>
	);
}
