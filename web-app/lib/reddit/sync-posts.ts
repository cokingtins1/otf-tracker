/**
 * Reddit post syncing logic
 * Fetches recent Daily Workout posts from splat_bot and stores them in the database
 */

import prisma from "@/prisma/__base";
import { fetchRecentWorkouts, type DailyWorkoutPost } from "./reddit-api";

export interface SyncResult {
	success: boolean;
	newPosts: number;
	updatedPosts: number;
	skippedPosts: number;
	errors: number;
	totalProcessed: number;
	error?: string;
}

/**
 * Get the timestamp of the most recent post in the database
 */
async function getMostRecentTimestamp(): Promise<number | undefined> {
	const mostRecent = await prisma.redditPost.findFirst({
		where: {
			author: "splat_bot",
			subreddit: "orangetheory",
		},
		orderBy: { createdUtc: "desc" },
		select: { createdUtc: true },
	});

	return mostRecent
		? Math.floor(mostRecent.createdUtc.getTime() / 1000)
		: undefined;
}

/**
 * Save or update a workout post in the database
 */
async function savePost(
	post: DailyWorkoutPost,
): Promise<"created" | "updated" | "skipped"> {
	const existing = await prisma.redditPost.findUnique({
		where: { redditId: post.redditId },
	});

	if (existing) {
		// Update if we have new workout content that was missing
		if (!existing.workoutContent && post.workoutContent) {
			await prisma.redditPost.update({
				where: { redditId: post.redditId },
				data: {
					workoutCommentId: post.workoutCommentId,
					workoutCommentPermalink: post.workoutCommentPermalink,
					workoutContent: post.workoutContent,
				},
			});
			return "updated";
		}
		return "skipped";
	}

	await prisma.redditPost.create({
		data: {
			redditId: post.redditId,
			permalink: post.permalink,
			title: post.title,
			author: post.author,
			subreddit: post.subreddit,
			createdUtc: post.createdUtc,
			selftext: post.selftext,
			selftextHtml: post.selftextHtml,
			url: post.url,
			score: post.score,
			upvoteRatio: post.upvoteRatio,
			numComments: post.numComments,
			flair: post.flair,
			rawJson: post.rawJson,
			workoutCommentId: post.workoutCommentId,
			workoutCommentPermalink: post.workoutCommentPermalink,
			workoutContent: post.workoutContent,
		},
	});
	return "created";
}

/**
 * Sync recent Daily Workout posts from Reddit
 * Fetches posts newer than the most recent one in the database
 */
export async function syncRecentPosts(options?: {
	limit?: number;
}): Promise<SyncResult> {
	try {
		const afterTimestamp = await getMostRecentTimestamp();
		console.log(
			`[SYNC] Starting from timestamp: ${afterTimestamp ? new Date(afterTimestamp * 1000).toISOString() : "beginning"}`,
		);

		const posts = await fetchRecentWorkouts({
			limit: options?.limit,
			afterTimestamp,
		});

		console.log(`[SYNC] Fetched ${posts.length} posts from Reddit API`);
		console.log("posts: ", posts);

		throw new Error("Debugging");

		let newPosts = 0;
		let updatedPosts = 0;
		let skippedPosts = 0;
		let errors = 0;

		for (const post of posts) {
			try {
				const result = await savePost(post);
				if (result === "created") {
					console.log(`🟢[NEW] ${post.title}`);
					newPosts++;
				} else if (result === "updated") {
					console.log(`🔄[UPDATED] ${post.title}`);
					updatedPosts++;
				} else {
					console.log(`⏭️[SKIP] ${post.title}`);
					skippedPosts++;
				}
			} catch (error) {
				console.error(
					`🆘[ERROR] Failed to save post ${post.redditId}:`,
					error,
				);
				errors++;
			}
		}

		return {
			success: true,
			newPosts,
			updatedPosts,
			skippedPosts,
			errors,
			totalProcessed: posts.length,
		};
	} catch (error) {
		console.error("[SYNC] Error:", error);
		return {
			success: false,
			newPosts: 0,
			updatedPosts: 0,
			skippedPosts: 0,
			errors: 0,
			totalProcessed: 0,
			error: error instanceof Error ? error.message : "Unknown error",
		};
	}
}
