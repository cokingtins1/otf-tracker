-- CreateTable
CREATE TABLE "RedditPost" (
    "id" TEXT NOT NULL,
    "redditId" TEXT NOT NULL,
    "permalink" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "author" TEXT NOT NULL,
    "subreddit" TEXT NOT NULL,
    "createdUtc" TIMESTAMP(3) NOT NULL,
    "selftext" TEXT,
    "selftextHtml" TEXT,
    "url" TEXT,
    "score" INTEGER,
    "upvoteRatio" DOUBLE PRECISION,
    "numComments" INTEGER,
    "flair" TEXT,
    "rawJson" TEXT NOT NULL,
    "workoutCommentId" TEXT,
    "workoutCommentPermalink" TEXT,
    "workoutContent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RedditPost_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "RedditPost_redditId_key" ON "RedditPost"("redditId");

-- CreateIndex
CREATE INDEX "RedditPost_author_createdUtc_idx" ON "RedditPost"("author", "createdUtc");

-- CreateIndex
CREATE INDEX "RedditPost_subreddit_createdUtc_idx" ON "RedditPost"("subreddit", "createdUtc");

-- CreateIndex
CREATE INDEX "RedditPost_author_subreddit_createdUtc_idx" ON "RedditPost"("author", "subreddit", "createdUtc" DESC);
