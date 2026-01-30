-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OAuthToken" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "accessToken" TEXT NOT NULL,
    "refreshToken" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "scope" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OAuthToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Workout" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "gmailMessageId" TEXT NOT NULL,
    "emailDate" TIMESTAMP(3) NOT NULL,
    "classTime" TEXT,
    "studioLocation" TEXT,
    "classInstructor" TEXT,
    "caloriesBurned" INTEGER,
    "splatPoints" INTEGER,
    "avgHeartRate" INTEGER,
    "peakHeartRate" INTEGER,
    "steps" INTEGER,
    "treadmillDistance" DOUBLE PRECISION,
    "treadmillTime" INTEGER,
    "treadmillAvgSpeed" DOUBLE PRECISION,
    "treadmillMaxSpeed" DOUBLE PRECISION,
    "treadmillAvgIncline" DOUBLE PRECISION,
    "treadmillMaxIncline" DOUBLE PRECISION,
    "treadmillAvgPace" INTEGER,
    "treadmillFastestPace" INTEGER,
    "treadmillElevation" DOUBLE PRECISION,
    "rowingDistance" DOUBLE PRECISION,
    "rowingTime" INTEGER,
    "rowingAvgWattage" INTEGER,
    "rowingMaxWattage" INTEGER,
    "rowingAvgSpeed" DOUBLE PRECISION,
    "rowingMaxSpeed" DOUBLE PRECISION,
    "rowing500mSplit" INTEGER,
    "rowingMax500mSplit" INTEGER,
    "rowingAvgStrokeRate" DOUBLE PRECISION,
    "activeMinutes" INTEGER,
    "minutesInGrayZone" INTEGER,
    "minutesInBlueZone" INTEGER,
    "minutesInGreenZone" INTEGER,
    "minutesInOrangeZone" INTEGER,
    "minutesInRedZone" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "rawHtml" TEXT NOT NULL,

    CONSTRAINT "Workout_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScrapedContent" (
    "id" SERIAL NOT NULL,
    "title" TEXT,
    "content" TEXT,
    "url" TEXT NOT NULL,
    "scrapedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ScrapedContent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "OAuthToken_userId_key" ON "OAuthToken"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Workout_gmailMessageId_key" ON "Workout"("gmailMessageId");

-- CreateIndex
CREATE INDEX "Workout_userId_emailDate_idx" ON "Workout"("userId", "emailDate");

-- AddForeignKey
ALTER TABLE "OAuthToken" ADD CONSTRAINT "OAuthToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Workout" ADD CONSTRAINT "Workout_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
