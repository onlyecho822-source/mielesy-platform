# mielesy-platform

Core application for The Mielesy Experience.

**Stack:** Next.js 14 · tRPC · Prisma · PostgreSQL · Stripe · Clerk · Upstash

## Setup

```bash
npm install
cp .env.example .env.local
# Fill in all env vars
npx prisma migrate dev
npm run dev
```

## Structure

```
src/
  server/
    routers/      tRPC routers (user, lane, gift, event, credit, admin)
    sonic/        SONIC notification layer
    trust/        Trust score engine
    lanes/        Lane management
    credits/      Credit ledger
  app/            Next.js App Router pages
  lib/            Shared utilities
prisma/
  schema.prisma   Canonical schema (G3/G4/G5 fixed)
  migrations/
```

## Environment Variables

See `.env.example` for all required variables.

## Docs

Full specs in [mielesy-docs](https://github.com/onlyecho822-source/mielesy-docs).
