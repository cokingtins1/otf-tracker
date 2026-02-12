/**
 * PullPush API client for fetching historical Reddit posts
 * No authentication required, no post limit
 * https://pullpush.io
 */

export interface PullPushSubmission {
	id: string;
	title: string;
	author: string;
	subreddit: string;
	created_utc: number;
	selftext: string | null;
	url: string;
	permalink: string;
	score: number;
	upvote_ratio?: number;
	num_comments: number;
	link_flair_text: string | null;
}

export interface PullPushComment {
	id: string;
	author: string;
	body: string;
	created_utc: number;
	link_id: string; // Submission ID with t3_ prefix
	parent_id: string;
	permalink: string;
	score: number;
	subreddit: string;
	is_submitter: boolean;
	distinguished: string | null; // "moderator" if mod comment
}

interface PullPushResponse<T> {
	data: T[];
}

/**
 * Retry a fetch with exponential backoff for transient errors
 */
async function fetchWithRetry(
	url: string,
	options: RequestInit,
	maxRetries = 3
): Promise<Response> {
	let lastError: Error | null = null;

	for (let attempt = 1; attempt <= maxRetries; attempt++) {
		try {
			const response = await fetch(url, options);

			// Retry on 5xx errors (server issues)
			if (response.status >= 500 && attempt < maxRetries) {
				const delay = Math.pow(2, attempt) * 1000; // 2s, 4s, 8s
				console.log(
					`⚠️[RETRY] API returned ${response.status}, retrying in ${delay / 1000}s (attempt ${attempt}/${maxRetries})`
				);
				await new Promise((resolve) => setTimeout(resolve, delay));
				continue;
			}

			return response;
		} catch (error) {
			lastError = error instanceof Error ? error : new Error(String(error));

			if (attempt < maxRetries) {
				const delay = Math.pow(2, attempt) * 1000;
				console.log(
					`⚠️[RETRY] Network error, retrying in ${delay / 1000}s (attempt ${attempt}/${maxRetries}): ${lastError.message}`
				);
				await new Promise((resolve) => setTimeout(resolve, delay));
			}
		}
	}

	throw lastError || new Error("Fetch failed after retries");
}

/**
 * Fetch submissions from PullPush API
 */
export async function fetchSubmissions(options: {
	subreddit?: string;
	author?: string;
	after?: number; // Unix timestamp
	before?: number; // Unix timestamp
	size?: number;
	sort?: "asc" | "desc";
	linkFlairText?: string; // Filter by flair
}): Promise<PullPushSubmission[]> {
	const params = new URLSearchParams();

	if (options.subreddit) {
		params.set("subreddit", options.subreddit);
	}
	if (options.author) {
		params.set("author", options.author);
	}
	if (options.after !== undefined) {
		params.set("after", options.after.toString());
	}
	if (options.before !== undefined) {
		params.set("before", options.before.toString());
	}
	if (options.size) {
		params.set("size", options.size.toString());
	}
	if (options.sort) {
		params.set("sort", options.sort);
	}
	if (options.linkFlairText) {
		params.set("link_flair_text", options.linkFlairText);
	}

	const url = `https://api.pullpush.io/reddit/search/submission/?${params}`;

	const response = await fetchWithRetry(url, {
		headers: {
			"User-Agent": process.env.REDDIT_USER_AGENT || "otf-tracker:v1.0",
		},
	});

	if (!response.ok) {
		const errorText = await response.text();
		throw new Error(
			`PullPush API error: ${response.status} - ${errorText}`
		);
	}

	const data: PullPushResponse<PullPushSubmission> = await response.json();
	return data.data || [];
}

/**
 * Fetch a comment by author on a specific submission
 */
export async function fetchCommentByAuthor(options: {
	linkId: string; // Submission ID without t3_ prefix
	author: string;
}): Promise<PullPushComment | null> {
	const params = new URLSearchParams({
		link_id: options.linkId,
		author: options.author,
		size: "1",
	});

	const url = `https://api.pullpush.io/reddit/search/comment/?${params}`;

	const response = await fetchWithRetry(url, {
		headers: {
			"User-Agent": process.env.REDDIT_USER_AGENT || "otf-tracker:v1.0",
		},
	});

	if (!response.ok) {
		const errorText = await response.text();
		throw new Error(
			`PullPush API error: ${response.status} - ${errorText}`
		);
	}

	const data: PullPushResponse<PullPushComment> = await response.json();
	return data.data?.[0] || null;
}

/**
 * Fetch the top comment (by score) on a specific submission
 */
export async function fetchTopComment(options: {
	linkId: string; // Submission ID without t3_ prefix
}): Promise<PullPushComment | null> {
	const params = new URLSearchParams({
		link_id: options.linkId,
		size: "1",
		sort: "desc",
		sort_type: "score",
	});

	const url = `https://api.pullpush.io/reddit/search/comment/?${params}`;

	const response = await fetchWithRetry(url, {
		headers: {
			"User-Agent": process.env.REDDIT_USER_AGENT || "otf-tracker:v1.0",
		},
	});

	if (!response.ok) {
		const errorText = await response.text();
		throw new Error(
			`PullPush API error: ${response.status} - ${errorText}`
		);
	}

	const data: PullPushResponse<PullPushComment> = await response.json();
	return data.data?.[0] || null;
}

/**
 * Fetch workout comment: first try moderator (author), then fallback to top comment
 */
export async function fetchWorkoutComment(options: {
	linkId: string;
	author: string;
}): Promise<{ comment: PullPushComment | null; source: "author" | "top" | "none" }> {
	// First try to get comment by the post author (moderator)
	const authorComment = await fetchCommentByAuthor({
		linkId: options.linkId,
		author: options.author,
	});

	if (authorComment) {
		return { comment: authorComment, source: "author" };
	}

	// Fallback to top comment by score
	const topComment = await fetchTopComment({ linkId: options.linkId });

	if (topComment) {
		return { comment: topComment, source: "top" };
	}

	return { comment: null, source: "none" };
}

/**
 * Fetch all submissions by paginating through results
 * @param afterTimestamp - Unix timestamp to start from (0 for all history)
 * @param limit - Maximum number of posts to fetch (null for no limit)
 * @param linkFlairText - Filter by flair text
 */
export async function fetchAllSubmissions(options: {
	subreddit: string;
	author: string;
	afterTimestamp?: number;
	limit?: number | null;
	linkFlairText?: string;
}): Promise<PullPushSubmission[]> {
	const allPosts: PullPushSubmission[] = [];
	let after = options.afterTimestamp || 0;
	const pageSize = options.limit ? Math.min(options.limit, 100) : 100;
	let page = 1;

	do {
		const afterDate = after ? new Date(after * 1000).toISOString().split('T')[0] : 'beginning';
		console.log(`📡[API] Fetching page ${page} (after: ${afterDate})...`);

		let posts: PullPushSubmission[];
		try {
			const startTime = Date.now();
			posts = await fetchSubmissions({
				subreddit: options.subreddit,
				author: options.author,
				after,
				size: pageSize,
				sort: "asc", // Oldest first for consistent pagination
				linkFlairText: options.linkFlairText,
			});
			const elapsed = Date.now() - startTime;
			console.log(`📡[API] Page ${page}: got ${posts.length} posts in ${elapsed}ms`);
		} catch (error) {
			// If API fails and we already have some posts, return what we have
			if (allPosts.length > 0) {
				console.log(`⚠️[API] Failed on page ${page}, returning ${allPosts.length} posts fetched so far`);
				return allPosts;
			}
			// If we have nothing, re-throw the error
			throw error;
		}

		if (posts.length === 0) {
			break;
		}

		allPosts.push(...posts);

		// Stop if we've reached the limit
		if (options.limit && allPosts.length >= options.limit) {
			return allPosts.slice(0, options.limit);
		}

		// Get the timestamp of the last post to use as the next 'after'
		// Add 1 second to avoid re-fetching the same post (API uses >= not >)
		const lastPost = posts[posts.length - 1];
		after = lastPost.created_utc + 1;
		page++;

		// Small delay to be nice to the API (rate limit: 15 req/min soft, 30 req/min hard)
		await new Promise((resolve) => setTimeout(resolve, 500));
	} while (true);

	return allPosts;
}
