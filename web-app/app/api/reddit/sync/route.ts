import { NextResponse } from "next/server";
import { syncRecentPosts } from "@/lib/reddit/sync-posts";

export async function POST(request: Request) {
	try {
		// Optional: parse limit from request body
		let limit: number | undefined;
		try {
			const body = await request.json();
			limit = body.limit;
		} catch {
			// No body or invalid JSON, use default
		}

		const result = await syncRecentPosts({ limit });

		return NextResponse.json(result);
	} catch (error) {
		console.error("[API] Reddit sync error:", error);
		return NextResponse.json(
			{
				success: false,
				error: "Failed to sync Reddit posts",
				details: error instanceof Error ? error.message : "Unknown error",
			},
			{ status: 500 }
		);
	}
}

export async function GET() {
	// GET method for easy testing / cron job triggers
	try {
		const result = await syncRecentPosts();
		return NextResponse.json(result);
	} catch (error) {
		console.error("[API] Reddit sync error:", error);
		return NextResponse.json(
			{
				success: false,
				error: "Failed to sync Reddit posts",
				details: error instanceof Error ? error.message : "Unknown error",
			},
			{ status: 500 }
		);
	}
}
