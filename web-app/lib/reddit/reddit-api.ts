/**
 * Reddit JSON API client for fetching recent posts from splat_bot
 * Uses the public /user/{username}.json endpoint
 * No authentication required
 */

const REDDIT_USER_AGENT = "otf-tracker:v1.0 (by /u/otf-tracker)";
const SPLAT_BOT_URL = "https://www.reddit.com/user/splat_bot.json";

// Reddit API response types
interface RedditComment {
	kind: "t1";
	data: {
		id: string;
		name: string; // t1_xxx
		author: string;
		body: string;
		body_html: string;
		link_id: string; // t3_xxx - the parent post
		link_title: string;
		link_author: string;
		link_permalink: string;
		permalink: string;
		subreddit: string;
		created_utc: number;
		score: number;
		distinguished: string | null;
		is_submitter: boolean;
	};
}

interface RedditPost {
	kind: "t3";
	data: {
		id: string;
		name: string; // t3_xxx
		author: string;
		title: string;
		selftext: string;
		selftext_html: string | null;
		permalink: string;
		url: string;
		subreddit: string;
		created_utc: number;
		score: number;
		upvote_ratio: number;
		num_comments: number;
		link_flair_text: string | null;
		distinguished: string | null;
	};
}

type RedditItem = RedditComment | RedditPost;

interface RedditListingResponse {
	kind: "Listing";
	data: {
		after: string | null;
		children: RedditItem[];
	};
}

export interface DailyWorkoutPost {
	redditId: string;
	permalink: string;
	title: string;
	author: string;
	subreddit: string;
	createdUtc: Date;
	selftext: string | null;
	selftextHtml: string | null;
	url: string | null;
	score: number | null;
	upvoteRatio: number | null;
	numComments: number | null;
	flair: string | null;
	rawJson: string;
	// Comment data (workout details)
	workoutCommentId: string | null;
	workoutCommentPermalink: string | null;
	workoutContent: string | null;
}

/**
 * Fetch recent activity from splat_bot's Reddit profile
 */
async function fetchSplatBotActivity(after?: string): Promise<RedditListingResponse> {
	const url = after ? `${SPLAT_BOT_URL}?after=${after}&limit=100` : `${SPLAT_BOT_URL}?limit=100`;

	const response = await fetch(url, {
		headers: {
			"User-Agent": REDDIT_USER_AGENT,
		},
	});

	if (!response.ok) {
		throw new Error(`Reddit API error: ${response.status} - ${response.statusText}`);
	}

	return response.json();
}

/**
 * Parse a Reddit post (t3) into our database format
 */
function parsePost(item: RedditPost): DailyWorkoutPost {
	const data = item.data;
	return {
		redditId: data.name, // t3_xxx
		permalink: data.permalink,
		title: data.title,
		author: data.author,
		subreddit: data.subreddit,
		createdUtc: new Date(data.created_utc * 1000),
		selftext: data.selftext || null,
		selftextHtml: data.selftext_html || null,
		url: data.url || null,
		score: data.score,
		upvoteRatio: data.upvote_ratio,
		numComments: data.num_comments,
		flair: data.link_flair_text || null,
		rawJson: JSON.stringify(data),
		workoutCommentId: null,
		workoutCommentPermalink: null,
		workoutContent: null,
	};
}

/**
 * Parse a Reddit comment (t1) that contains workout details
 * These are comments by splat_bot on Daily Workout posts where link_author is also splat_bot
 */
function parseWorkoutComment(item: RedditComment): DailyWorkoutPost {
	const data = item.data;
	return {
		redditId: data.link_id, // t3_xxx - the parent post ID
		permalink: data.link_permalink,
		title: data.link_title,
		author: data.link_author,
		subreddit: data.subreddit,
		createdUtc: new Date(data.created_utc * 1000),
		selftext: null,
		selftextHtml: null,
		url: null,
		score: null,
		upvoteRatio: null,
		numComments: null,
		flair: "Daily Workout", // Comments on daily workout posts
		rawJson: JSON.stringify(data),
		workoutCommentId: data.name, // t1_xxx
		workoutCommentPermalink: data.permalink,
		workoutContent: data.body,
	};
}

/**
 * Fetch all recent Daily Workout posts from splat_bot
 * This fetches the user's activity and filters for:
 * - Posts (t3) with "Daily Workout" flair
 * - Comments (t1) on posts where link_author is splat_bot (contains workout details)
 */
export async function fetchRecentWorkouts(options?: {
	limit?: number;
	afterTimestamp?: number;
}): Promise<DailyWorkoutPost[]> {
	const results: Map<string, DailyWorkoutPost> = new Map();
	let after: string | undefined;
	let pages = 0;
	const maxPages = 10; // Safety limit
	const limit = options?.limit;
	const afterTimestamp = options?.afterTimestamp;

	do {
		console.log(`📡[REDDIT] Fetching page ${pages + 1}...`);
		const response = await fetchSplatBotActivity(after);

		for (const item of response.data.children) {
			// Check timestamp cutoff
			const createdUtc = item.data.created_utc;
			if (afterTimestamp && createdUtc <= afterTimestamp) {
				console.log(`📡[REDDIT] Reached posts older than cutoff, stopping`);
				return Array.from(results.values());
			}

			if (item.kind === "t3") {
				// It's a post - check if it's a Daily Workout post
				const post = item as RedditPost;
				if (post.data.link_flair_text === "Daily Workout" && post.data.author === "splat_bot") {
					const parsed = parsePost(post);
					if (!results.has(parsed.redditId)) {
						results.set(parsed.redditId, parsed);
						console.log(`🟢[POST] ${post.data.title}`);
					}
				}
			} else if (item.kind === "t1") {
				// It's a comment - check if it's a workout comment on a splat_bot post
				const comment = item as RedditComment;
				if (comment.data.link_author === "splat_bot" && comment.data.subreddit === "orangetheory") {
					const parsed = parseWorkoutComment(comment);
					const existing = results.get(parsed.redditId);
					if (existing) {
						// Update existing post with comment data
						existing.workoutCommentId = parsed.workoutCommentId;
						existing.workoutCommentPermalink = parsed.workoutCommentPermalink;
						existing.workoutContent = parsed.workoutContent;
					} else {
						// Add new entry from comment
						results.set(parsed.redditId, parsed);
						console.log(`🟢[COMMENT] ${comment.data.link_title}`);
					}
				}
			}

			// Check limit
			if (limit && results.size >= limit) {
				return Array.from(results.values()).slice(0, limit);
			}
		}

		after = response.data.after || undefined;
		pages++;

		// Rate limit: be nice to Reddit
		await new Promise((resolve) => setTimeout(resolve, 1000));
	} while (after && pages < maxPages);

	return Array.from(results.values());
}
