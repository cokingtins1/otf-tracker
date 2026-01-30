# OTF Tracker - Architecture Documentation

## Project Overview

OTF Tracker is a Next.js application that syncs OrangeTheory Fitness workout data from Gmail emails. It uses server-side OAuth to securely access Gmail, fetches emails with the "OTF" label, parses workout metrics, and stores them in a local SQLite database.

**Tech Stack:**
- Next.js 14.2.16 (App Router)
- TypeScript
- Prisma ORM with SQLite
- Google APIs (Gmail API)
- Shadcn/ui Components
- Tailwind CSS

---

## Architecture Overview

```
┌─────────────┐
│   Browser   │
└──────┬──────┘
       │
       │ 1. Click "Connect Gmail"
       ▼
┌─────────────────────────────────┐
│  /api/auth/google (API Route)  │
│  - Generates OAuth URL          │
│  - Redirects to Google          │
└──────┬──────────────────────────┘
       │
       │ 2. User authorizes
       ▼
┌─────────────────────────────────┐
│       Google OAuth Screen       │
└──────┬──────────────────────────┘
       │
       │ 3. Callback with auth code
       ▼
┌─────────────────────────────────┐
│ /api/auth/callback (API Route) │
│  - Exchange code for tokens     │
│  - Encrypt & store in DB        │
│  - Create/fetch user            │
│  - Redirect to /dashboard       │
└──────┬──────────────────────────┘
       │
       │ 4. User lands on dashboard
       ▼
┌─────────────────────────────────┐
│      /dashboard (Page)          │
│  - "Sync Workouts" button       │
└──────┬──────────────────────────┘
       │
       │ 5. Click "Sync Workouts"
       ▼
┌─────────────────────────────────┐
│  /api/gmail/sync (API Route)   │
│  - Get valid access token       │
│  - Fetch OTF labeled emails     │
│  - Parse workout data           │
│  - Store in database            │
│  - Return sync stats            │
└─────────────────────────────────┘
```

---

## Database Schema

### Prisma Models

**User**
- Stores basic user information
- Single user for personal use (identified by ADMIN_EMAIL env var)

```prisma
model User {
  id        String   @id @default(cuid())
  email     String   @unique
  name      String?
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  tokens   OAuthToken[]
  workouts Workout[]
}
```

**OAuthToken**
- Stores encrypted OAuth tokens
- One token record per user (upserted on each auth)
- Access token expires, refresh token persists

```prisma
model OAuthToken {
  id           String   @id @default(cuid())
  userId       String   @unique

  accessToken  String   // AES-256 encrypted
  refreshToken String   // AES-256 encrypted
  expiresAt    DateTime
  scope        String

  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt
}
```

**Workout**
- Stores parsed OTF workout metrics
- `gmailMessageId` is unique to prevent duplicates
- `rawHtml` stored for re-parsing if needed

```prisma
model Workout {
  id               String   @id @default(cuid())
  userId           String

  // Email metadata
  gmailMessageId   String   @unique
  emailDate        DateTime

  // Workout metrics
  caloriesBurned   Int?
  splatPoints      Int?
  avgHeartRate     Int?
  peakHeartRate    Int?
  steps            Int?
  treadmillDistance Float?
  treadmillTime     String?
  rowingDistance   Float?
  rowingTime       String?

  // Heart rate zones
  activeMinutes    Int?
  minutesInGrayZone Int?
  minutesInBlueZone Int?
  minutesInGreenZone Int?
  minutesInOrangeZone Int?
  minutesInRedZone Int?

  // Raw data
  rawHtml          String

  createdAt        DateTime @default(now())
  updatedAt        DateTime @updatedAt
}
```

---

## Authentication Flow

### OAuth 2.0 Server-Side Implementation

**Why server-side?**
- Refresh tokens must be kept secret (not exposed to browser)
- Enables automatic token refresh
- More secure token storage with encryption

**Flow:**

1. **Initiation** (`/api/auth/google/route.ts`)
   - Generates Google OAuth URL with:
     - `access_type: 'offline'` - to get refresh token
     - `prompt: 'consent'` - to force consent screen
     - `scope: gmail.readonly` - read-only Gmail access
   - Redirects user to Google OAuth consent screen

2. **Callback** (`/api/auth/callback/route.ts`)
   - Receives authorization code from Google
   - Exchanges code for tokens (access + refresh)
   - Creates/fetches user from database (using ADMIN_EMAIL)
   - Encrypts tokens using AES-256
   - Stores in database
   - Redirects to `/dashboard`

3. **Token Management** (`lib/db/oauth-tokens.ts`)
   - `saveOAuthTokens()` - Upserts encrypted tokens
   - `getValidAccessToken()` - Returns valid token or auto-refreshes
   - Automatic refresh when `expiresAt` is past current time

**Security Features:**
- Tokens encrypted at rest with `TOKEN_ENCRYPTION_KEY`
- Only server-side code can decrypt tokens
- No tokens exposed to browser/client
- HTTPS required in production

---

## Gmail Integration

### Fetching Messages (`lib/gmail/fetch-messages.ts`)

**fetchOTFMessages(accessToken)**
1. Initialize Gmail API client with OAuth2
2. Fetch all labels from user's Gmail
3. Find label with name "OTF"
4. Fetch up to 500 messages with that label ID
5. For each message, fetch full details (including HTML body)
6. Return array of message objects

**extractHtmlFromMessage(message)**
- Handles different Gmail message structures:
  - Simple messages (body.data)
  - Multipart messages (parts[].mimeType === 'text/html')
  - Nested multipart messages
- Decodes base64-encoded HTML content
- Returns HTML string or null

**extractDateFromMessage(message)**
- Extracts "Date" header from email
- Falls back to `internalDate` if header missing
- Returns JavaScript Date object

---

## Email Parsing

### Parser Logic (`lib/parsers/otf-email-parser.ts`)

**parseWorkoutEmail(html)**

Uses Cheerio (jQuery-like HTML parser) to extract metrics:

**Main Metrics:**
- Calories Burned - finds "CALORIES BURNED" text, extracts number above
- Splat Points - finds "SPLAT POINTS" text, extracts number
- Avg Heart Rate - finds "AVG. HEART-RATE" text, extracts number
- Steps - finds "STEPS" text, extracts number
- Treadmill Distance - finds "Total Distance", extracts miles
- Treadmill Time - finds "Total Time", extracts MM:SS format

**Heart Rate Data:**
- Peak Heart Rate - searches for "Peak HR:" text pattern
- Heart Rate Zones - searches for GRAY/BLUE/GREEN/ORANGE/RED with minutes
- Active Minutes - calculated as sum of all zone minutes

**Parsing Strategy:**
- Uses CSS selectors when possible (`p.h2.text-gray`)
- Falls back to text search for reliability
- Handles missing fields (returns null)
- Stores raw HTML for future re-parsing if format changes

---

## API Routes

### `/api/auth/google` (GET)
- **Purpose:** Initiate OAuth flow
- **Returns:** Redirect to Google OAuth consent screen
- **Dependencies:** `lib/auth/google.ts`

### `/api/auth/callback` (GET)
- **Purpose:** Handle OAuth callback
- **Query Params:** `code` (auth code) or `error`
- **Process:**
  1. Validate code parameter
  2. Exchange code for tokens
  3. Get/create user
  4. Save encrypted tokens
  5. Redirect to `/dashboard`
- **Error Handling:** Redirects to `/?error=<error_type>`

### `/api/gmail/sync` (POST)
- **Purpose:** Sync workouts from Gmail
- **Authentication:** Requires valid OAuth token in database
- **Process:**
  1. Fetch user from database (ADMIN_EMAIL)
  2. Get valid access token (auto-refreshes if expired)
  3. Fetch OTF labeled messages from Gmail
  4. For each message:
     - Check if already processed (by gmailMessageId)
     - Skip if exists, otherwise:
     - Extract HTML content
     - Parse workout metrics
     - Save to database
  5. Return sync statistics
- **Response:**
  ```json
  {
    "success": true,
    "newWorkouts": 5,
    "skippedWorkouts": 20,
    "errors": 0,
    "totalProcessed": 25
  }
  ```

---

## Pages

### `/` (Homepage)
- Landing page with "Connect Gmail Account" button
- Theme switcher in top-right
- Links to `/api/auth/google` to initiate OAuth

### `/dashboard` (Dashboard)
- Client component with sync functionality
- "Sync Workouts from Gmail" button
- Displays sync results:
  - Success: Shows new workouts, skipped, total processed
  - Error: Shows error message and details
- Dark/light theme support

---

## Utility Libraries

### `lib/db/prisma.ts`
- Prisma Client singleton pattern
- Prevents multiple instances in development
- Global variable caching

### `lib/auth/google.ts`
- OAuth2 client configuration
- `getOAuth2Client()` - Returns configured OAuth2 client
- `getAuthUrl()` - Generates consent screen URL
- `getTokensFromCode(code)` - Exchanges auth code for tokens

### `lib/auth/token-encryption.ts`
- AES-256 encryption using crypto-js
- `encryptToken(token)` - Encrypts string
- `decryptToken(encryptedToken)` - Decrypts string
- Uses `TOKEN_ENCRYPTION_KEY` from environment

### `lib/db/oauth-tokens.ts`
- Token CRUD operations
- `saveOAuthTokens()` - Upsert encrypted tokens
- `getValidAccessToken()` - Get valid token or auto-refresh
- Automatic refresh logic when token expired

---

## Environment Variables

### Required (`.env.local`)

```bash
# Public (exposed to browser)
NEXT_PUBLIC_OTF_TRACKER_API_KEY=<Google API Key>
NEXT_PUBLIC_CLIENT_ID=<Google OAuth Client ID>

# Server-side only
GOOGLE_CLIENT_ID=<Same as NEXT_PUBLIC_CLIENT_ID>
GOOGLE_CLIENT_SECRET=<From Google Cloud Console>
GOOGLE_REDIRECT_URI=http://localhost:3000/api/auth/callback

# Database
DATABASE_URL="file:./dev.db"

# Token encryption (generate with: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")
TOKEN_ENCRYPTION_KEY=<64-character hex string>

# Admin user
ADMIN_EMAIL=<Your Gmail address>
```

### Additional (`.env` for Prisma)
```bash
DATABASE_URL="file:./dev.db"
```

---

## File Structure

```
otf-tracker/
├── app/
│   ├── api/
│   │   ├── auth/
│   │   │   ├── google/route.ts      # OAuth initiation
│   │   │   └── callback/route.ts    # OAuth callback
│   │   └── gmail/
│   │       └── sync/route.ts        # Sync endpoint
│   ├── dashboard/
│   │   └── page.tsx                 # Dashboard page
│   ├── page.tsx                     # Homepage
│   ├── layout.tsx                   # Root layout
│   └── globals.css                  # Global styles
│
├── lib/
│   ├── auth/
│   │   ├── google.ts                # OAuth client setup
│   │   └── token-encryption.ts      # Token encryption
│   ├── db/
│   │   ├── prisma.ts                # Prisma client
│   │   └── oauth-tokens.ts          # Token management
│   ├── gmail/
│   │   └── fetch-messages.ts        # Gmail API integration
│   ├── parsers/
│   │   └── otf-email-parser.ts      # Email parsing logic
│   └── utils.ts                     # Utility functions
│
├── components/
│   ├── ui/                          # Shadcn/ui components
│   │   └── button.tsx
│   └── custom/                      # Custom components
│       ├── theme-switch.tsx
│       └── debug-theme.tsx
│
├── prisma/
│   ├── schema.prisma                # Database schema
│   ├── dev.db                       # SQLite database
│   └── migrations/                  # Migration files
│
├── .env.local                       # Environment variables (not committed)
├── .env                             # Prisma env (not committed)
├── credentials.json                 # Google OAuth credentials
├── package.json
├── tsconfig.json
├── tailwind.config.ts
└── next.config.mjs
```

---

## Data Flow

### 1. OAuth Token Flow
```
User → /api/auth/google → Google OAuth → /api/auth/callback → Database (encrypted tokens)
```

### 2. Sync Workflow
```
Dashboard → POST /api/gmail/sync
  ↓
Fetch user from DB
  ↓
Get valid access token (auto-refresh if needed)
  ↓
Fetch OTF labeled messages from Gmail
  ↓
For each message:
  - Check if exists (gmailMessageId)
  - Extract HTML
  - Parse metrics
  - Save to database
  ↓
Return sync statistics
```

### 3. Token Refresh Flow
```
getValidAccessToken(userId)
  ↓
Fetch token from DB
  ↓
Check if expired
  ↓
If expired:
  - Use refresh token to get new access token
  - Save new tokens (encrypted)
  - Return new access token
Else:
  - Decrypt and return access token
```

---

## How to Use

### Initial Setup

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Set up environment variables:**
   - Copy `.env.local.example` to `.env.local` (or create manually)
   - Add Google OAuth credentials from [Google Cloud Console](https://console.cloud.google.com)
   - Generate encryption key:
     ```bash
     node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
     ```
   - Set ADMIN_EMAIL to your Gmail address

3. **Set up database:**
   ```bash
   npx prisma migrate dev --name init
   npx prisma generate
   ```

4. **Label emails in Gmail:**
   - Create label "OTF" in Gmail
   - Apply to all OrangeTheory workout emails

### Running the App

1. **Start development server:**
   ```bash
   npm run dev
   ```

2. **Visit** `http://localhost:3000`

3. **Connect Gmail:**
   - Click "Connect Gmail Account"
   - Authorize the application
   - You'll be redirected to `/dashboard`

4. **Sync workouts:**
   - Click "Sync Workouts from Gmail"
   - Wait for sync to complete
   - View results

5. **View database:**
   ```bash
   npx prisma studio
   ```
   - Opens browser interface to view database
   - Navigate to "Workout" model to see parsed data

---

## Security Considerations

### Token Security
- **Encryption at rest:** All OAuth tokens encrypted with AES-256
- **Server-side only:** Tokens never exposed to client/browser
- **Automatic rotation:** Access tokens auto-refresh using refresh token
- **Environment variables:** All secrets in `.env.local` (gitignored)

### OAuth Security
- **Read-only scope:** Only `gmail.readonly` scope requested
- **HTTPS required:** Production must use HTTPS for OAuth callback
- **State validation:** OAuth callback validates state parameter (Next.js handles this)

### Database Security
- **Local SQLite:** Database file stored locally (not cloud-accessible)
- **Unique constraints:** `gmailMessageId` prevents duplicate workouts
- **Cascade deletes:** Deleting user removes all related data

---

## Performance Optimizations

### Gmail API
- **Batch fetching:** Fetches up to 500 messages per sync
- **Parallel processing:** Uses `Promise.all()` for message fetching
- **Duplicate prevention:** Checks database before parsing each email

### Database
- **Indexes:** `userId` and `emailDate` indexed for faster queries
- **Upserts:** Token updates use upsert for efficiency
- **Connection pooling:** Prisma handles connection management

---

## Error Handling

### OAuth Errors
- Missing code → Redirect to `/?error=no_code`
- Auth failure → Redirect to `/?error=auth_failed`
- Token refresh failure → Returns null, requires re-auth

### Sync Errors
- Missing OTF label → Throws error with message
- No Gmail access → 401 Unauthorized
- Parsing errors → Skipped, counted in `errors` field
- Database errors → 500 with error details

---

## Future Enhancements

### Planned Features
1. **Workout List View**
   - Paginated table of all workouts
   - Sortable by date, calories, splat points
   - Filterable by date range, metrics

2. **Analytics Dashboard**
   - Charts using Recharts library
   - Trends: calories over time, splat points progression
   - Statistics: average heart rate, total workouts, etc.

3. **Automatic Sync**
   - Cron job (daily sync)
   - Background task using Vercel Cron or similar

4. **Export Functionality**
   - CSV export for Excel/Sheets
   - JSON export for data portability

5. **Advanced Filtering**
   - Filter by metric thresholds
   - Search by date range
   - View specific heart rate zones

6. **Multi-user Support** (if needed)
   - User authentication system
   - Multiple Gmail accounts
   - User-specific dashboards

---

## Troubleshooting

### Common Issues

**"OTF label not found in Gmail"**
- Ensure you've created a label named exactly "OTF" in Gmail
- Apply the label to your OrangeTheory emails

**"Not authenticated" error**
- Re-run OAuth flow (visit homepage and click "Connect Gmail")
- Check that tokens are in database (Prisma Studio)

**"Environment variable not found"**
- Verify all required env vars are in `.env.local`
- Restart Next.js dev server after adding env vars

**No workouts synced (0 new)**
- Check if emails are labeled "OTF"
- Verify emails haven't already been synced (check database)
- Look for errors in sync response

**Token refresh fails**
- Delete token from database
- Re-authenticate via OAuth flow
- Ensure `GOOGLE_CLIENT_SECRET` is correct

---

## Development Commands

```bash
# Start dev server
npm run dev

# Build for production
npm run build

# Start production server
npm start

# Lint code
npm run lint

# Format code (if Prettier configured)
npm run format

# Prisma commands
npx prisma studio              # Open database viewer
npx prisma generate            # Regenerate Prisma Client
npx prisma migrate dev         # Create & apply migration
npx prisma migrate reset       # Reset database (WARNING: deletes data)
npx prisma db push            # Push schema without migration

# Database utilities
npx prisma db seed            # Seed database (if configured)
```

---

## Contributing

When making changes:

1. **Database schema changes:**
   - Update `prisma/schema.prisma`
   - Run `npx prisma migrate dev --name <migration_name>`
   - Update this documentation

2. **New API routes:**
   - Document in this file (API Routes section)
   - Add error handling
   - Update Data Flow diagrams if needed

3. **Parser updates:**
   - Test with multiple email samples
   - Handle missing/malformed data gracefully
   - Consider storing raw HTML for re-parsing

4. **Environment variables:**
   - Add to `.env.example` (create if doesn't exist)
   - Document in Environment Variables section
   - Never commit actual values

---

## License

[Add your license here]

## Contact

[Add contact information]

---

**Last Updated:** January 2026
**Version:** 1.0.0
