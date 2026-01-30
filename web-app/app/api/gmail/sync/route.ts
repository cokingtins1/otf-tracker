import { NextResponse } from "next/server";
// import { prisma } from '@/lib/db/prisma';
import prisma from "@/prisma/__base";
import { getValidAccessToken } from "@/lib/db/oauth-tokens";
import {
	fetchOTFMessages,
	extractHtmlFromMessage,
	extractDateFromMessage,
} from "@/lib/gmail/fetch-messages";
import { parseWorkoutEmail } from "@/lib/parsers/otf-email-parser";

export async function POST() {
	try {
		// Get admin user
		const user = await prisma.user.findUnique({
			where: { email: process.env.ADMIN_EMAIL! },
		});

		if (!user) {
			return NextResponse.json(
				{ error: "User not found" },
				{ status: 404 }
			);
		}

		// Get valid access token
		const accessToken = await getValidAccessToken(user.id);
		if (!accessToken) {
			return NextResponse.json(
				{ error: "Not authenticated" },
				{ status: 401 }
			);
		}

		// Fetch messages
		const messages = await fetchOTFMessages(accessToken);

		let newWorkouts = 0;
		let skippedWorkouts = 0;
		let errors = 0;

		for (const message of messages) {
			try {
				const gmailMessageId = message.id!;

				// Check if already processed
				const existing = await prisma.workout.findUnique({
					where: { gmailMessageId },
				});

				if (existing) {
					skippedWorkouts++;
					continue;
				}

				// Extract and parse
				const html = extractHtmlFromMessage(message);
				if (!html) {
					errors++;
					continue;
				}

				const emailDate = extractDateFromMessage(message);
				const workoutData = parseWorkoutEmail(html);

				// Save to database
				await prisma.workout.create({
					data: {
						userId: user.id,
						gmailMessageId,
						emailDate,
						rawHtml: html,
						...workoutData,
					},
				});

				newWorkouts++;
			} catch (error) {
				console.error("Error processing message:", message.id, error);
				errors++;
			}
		}

		return NextResponse.json({
			success: true,
			newWorkouts,
			skippedWorkouts,
			errors,
			totalProcessed: messages.length,
		});
	} catch (error) {
		console.error("Sync error:", error);
		return NextResponse.json(
			{
				error: "Failed to sync emails",
				details:
					error instanceof Error ? error.message : "Unknown error",
			},
			{ status: 500 }
		);
	}
}
