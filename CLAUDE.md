# CLAUDE.md

## Project Overview

OTF Tracker is a monorepo with two services orchestrated via Docker Compose, sharing a PostgreSQL database:

- **web-app**: Next.js 14 app that syncs OrangeTheory Fitness workout data from Gmail
- **scraper**: Node.js script that scrapes web content and stores it in the shared database

## Docker Compose Commands

```bash
# Start all persistent services (postgres + web-app)
docker compose up -d

# Run the scraper (one-off, manual profile)
docker compose run --rm scraper

# Start only postgres
docker compose up -d postgres

# Rebuild after code changes
docker compose up -d --build

# Stop everything
docker compose down

# View logs
docker compose logs -f web-app
```

## Shared Database

Both services connect to the same PostgreSQL instance (`otf_db`) using `DATABASE_URL`. The web-app owns migrations (`npx prisma migrate deploy` runs on startup). The scraper has its own copy of the Prisma schema for client generation.

Key tables:
- **User, OAuthToken, Workout** — managed by web-app
- **ScrapedContent** — managed by scraper

## Environment Variables

Root `.env` provides `DB_USER`, `DB_PASSWORD`, and `DATABASE_URL` for Docker Compose.
`web-app/.env.local` provides app-specific vars (Google OAuth, encryption keys, etc.).

## Local Development (without Docker)

```bash
# Web-app
cd web-app
DATABASE_URL=postgresql://user:pass@localhost:5432/otf_db npm run dev

# Scraper
cd scraper
DATABASE_URL=postgresql://user:pass@localhost:5432/otf_db npm run dev
```
