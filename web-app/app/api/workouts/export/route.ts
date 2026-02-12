import { NextResponse } from "next/server";
import prisma from "@/prisma/__base";

export async function GET() {
	try {
		const workouts = await prisma.workout.findMany({
			select: {
				id: true,
				gmailMessageId: true,
				emailDate: true,
				caloriesBurned: true,
				splatPoints: true,
				avgHeartRate: true,
				peakHeartRate: true,
				steps: true,
				treadmillDistance: true,
				treadmillTime: true,
				rowingDistance: true,
				rowingTime: true,
				activeMinutes: true,
				minutesInGrayZone: true,
				minutesInBlueZone: true,
				minutesInGreenZone: true,
				minutesInOrangeZone: true,
				minutesInRedZone: true,
				createdAt: true,
			},
			orderBy: { emailDate: "desc" },
		});

		const headers = [
			"id",
			"gmailMessageId",
			"emailDate",
			"caloriesBurned",
			"splatPoints",
			"avgHeartRate",
			"peakHeartRate",
			"steps",
			"treadmillDistance",
			"treadmillTime",
			"rowingDistance",
			"rowingTime",
			"activeMinutes",
			"minutesInGrayZone",
			"minutesInBlueZone",
			"minutesInGreenZone",
			"minutesInOrangeZone",
			"minutesInRedZone",
			"createdAt",
		];

		const rows = workouts.map((w) =>
			headers
				.map((h) => {
					const value = w[h as keyof typeof w];
					if (value === null || value === undefined) return "";
					if (value instanceof Date) return value.toISOString();
					if (typeof value === "string" && value.includes(",")) {
						return `"${value.replace(/"/g, '""')}"`;
					}
					return String(value);
				})
				.join(",")
		);

		const csv = [headers.join(","), ...rows].join("\n");

		return new NextResponse(csv, {
			headers: {
				"Content-Type": "text/csv",
				"Content-Disposition": `attachment; filename="otf-workouts-${new Date().toISOString().split("T")[0]}.csv"`,
			},
		});
	} catch (error) {
		return NextResponse.json(
			{
				error: "Failed to export workouts",
				details: error instanceof Error ? error.message : "Unknown error",
			},
			{ status: 500 }
		);
	}
}
