# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

OTF Tracker is a Next.js 14 (App Router) application that syncs OrangeTheory Fitness workout data by parsing workout summary emails from Gmail. Users authenticate via Google OAuth to grant read-only Gmail access, and the app fetches emails labeled "OTF" to extract ~40 workout metrics using Cheerio HTML parsing, storing them in PostgreSQL via Prisma.

## Commands

All commands run from the `web-app/` directory:

```bash
npm run dev          # Start development server (localhost:3000)
npm run build        # Production build
npm run lint         # ESLint
npm test             # Run Jest tests
npm run test:watch   # Run tests in watch mode
```

Run a single test file or specific test:
```bash
npx jest lib/parsers/otf-email-parser.test.ts
npx jest -t "example2.eml"                      # Filter by test name
```

Prisma/database commands:
```bash
npx prisma migrate dev --name <migration-name>   # Create and apply migration
npx prisma db push                                # Push schema without migration
npx prisma studio                                 # Open DB GUI browser
npx prisma generate                               # Regenerate Prisma client
```

There is also a separate `/scraper` directory with its own `package.json` (independent Node.js service, not integrated with the web app).

## Architecture

### Data Flow
1. User authenticates via `/api/auth/google` → Google OAuth callback at `/api/auth/callback`
2. OAuth tokens are AES-encrypted and stored in SQLite via Prisma
3. `/api/gmail/sync` fetches emails with "OTF" label from Gmail API
4. `lib/parsers/otf-email-parser.ts` parses HTML emails using Cheerio to extract workout metrics
5. Parsed workouts are saved to the `Workout` table with raw HTML preserved for re-parsing

### Key Modules

- **`prisma/__base.ts`**: Prisma client singleton (PrismaPg adapter, connects via `DATABASE_URL`). New code should import from `@/prisma/__base`, not `lib/db/prisma.ts`
- **`lib/auth/token-encryption.ts`**: AES encryption for OAuth tokens using `TOKEN_ENCRYPTION_KEY` env var
- **`lib/db/oauth-tokens.ts`**: Token storage with automatic refresh when expired
- **`lib/gmail/fetch-messages.ts`**: Gmail API integration - fetches messages by label, extracts HTML from multipart messages
- **`lib/parsers/otf-email-parser.ts`**: Core parser extracting ~40 workout metrics from OTF email HTML

### Database Schema (Prisma/PostgreSQL)

- **User**: Email-based user (single admin via `ADMIN_EMAIL` env var)
- **OAuthToken**: Encrypted access/refresh tokens with expiration tracking (one per user)
- **Workout**: Class metadata, heart rate zones, treadmill stats, rowing stats. `gmailMessageId` unique constraint prevents duplicates. Indexed on `(userId, emailDate)`. Stores `rawHtml` for re-parsing.

### Testing

Tests use Jest with ts-jest. Test files are in `lib/parsers/`. Tests load `.eml` files and verify parsed metrics using a `testEmailFile()` helper. Time values are stored in seconds (e.g., `16:48` MM:SS = 1008 seconds). See `TESTING.md` for adding new email test cases.

### Environment Variables Required

- `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI`: Google OAuth credentials
- `TOKEN_ENCRYPTION_KEY`: 64-char hex AES key for encrypting stored OAuth tokens
- `ADMIN_EMAIL`: Email address of the admin user for sync operations
- `DATABASE_URL`: PostgreSQL connection string (e.g., `postgresql://user:pass@localhost:5432/otf_db`)

### Additional Documentation

- `ARCHITECTURE.md`: Detailed architecture, API routes, data flows, and setup instructions
- `TESTING.md`: Testing guide with format conventions and debugging tips
