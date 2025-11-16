# WARP.md

This file provides guidance to WARP (warp.dev) when working with code in this repository.

## Project Overview

This is a Hive Upvote Calculator - a full-stack web application that calculates upvote values for Hive blockchain accounts based on their Hive Power. The app fetches real-time HIVE price data and blockchain parameters to provide accurate voting power estimations. Created by the Aliento Project (aliento.blog).

## Commands

### Development
```bash
npm run dev
```
Starts the development server on port 5000 with hot module replacement (HMR). Uses `tsx` to run the TypeScript server with Vite for the client.

### Production Build
```bash
npm run build
```
Builds both client and server:
- Client: Vite builds optimized static assets to `dist/public`
- Server: ESBuild bundles server code to `dist/index.js`

### Start Production Server
```bash
npm start
```
Runs the production build from `dist/index.js` on port 5000.

### Type Checking
```bash
npm run check
```
Runs TypeScript compiler without emitting files to validate types across the entire codebase.

### Database
```bash
npm run db:push
```
Pushes Drizzle ORM schema changes to the PostgreSQL database. Requires `DATABASE_URL` environment variable.

## Architecture

### Monorepo Structure

The project follows a clear separation of concerns with three main directories:

**`client/`** - React/TypeScript frontend
- `client/src/pages/` - Route components (home.tsx, not-found.tsx)
- `client/src/components/` - React components, primarily shadcn/ui components in `ui/` subdirectory
- `client/src/lib/` - Utilities (queryClient, translations, utils)
- `client/src/hooks/` - Custom React hooks (useTranslation, use-toast, use-mobile)
- `client/index.html` - HTML entry point with meta tags and Open Graph tags

**`server/`** - Express.js backend
- `server/index.ts` - Express app setup with middleware and error handling
- `server/routes.ts` - API endpoints (`/api/hive-price`, `/api/calculate-vote`)
- `server/vite.ts` - Vite dev server integration and static file serving
- `server/storage.ts` - Database and session storage configuration

**`shared/`** - Shared TypeScript code
- `shared/schema.ts` - Drizzle ORM schema definitions and Zod validation schemas

### Technology Stack

**Frontend:**
- React 18 with TypeScript
- Vite for build tooling (port 5000 in dev, serves both API and client)
- shadcn/ui component library built on Radix UI primitives
- Tailwind CSS with CSS variables for theming (dark mode support via `hive-calculator-theme` localStorage key)
- React Query (TanStack Query) for server state management with 5-minute cache intervals
- Wouter for client-side routing
- React Hook Form with Zod resolvers for form validation

**Backend:**
- Express.js server with TypeScript
- RESTful API architecture
- Integration with HAF Explorer API and Hive blockchain APIs (api.hive.blog)
- Drizzle ORM with PostgreSQL adapter
- Session-based architecture with memory storage

### Path Aliases

The project uses TypeScript path aliases:
- `@/*` → `./client/src/*`
- `@shared/*` → `./shared/*`
- `@assets/*` → `./attached_assets/*`

### Data Flow & External APIs

1. **HIVE Price Fetching** (`GET /api/hive-price`):
   - Primary: HAF Explorer API witness price feeds (`https://api.syncad.com/hafbe-api/witnesses?limit=1`)
   - Fallback: CoinGecko API
   - Last resort: Hardcoded fallback price (0.198)

2. **Vote Calculation** (`POST /api/calculate-vote`):
   - Fetches real-time blockchain parameters from Hive blockchain APIs:
     - `condenser_api.get_dynamic_global_properties` - Total vesting fund and shares
     - `condenser_api.get_reward_fund` - Reward balance and recent claims
   - Implements official Hive rshares-based vote formula:
     ```
     totalVests = (hivePower * totalVestingShares) / totalVestingFundHive
     rshares = (votePowerFactor * totalVests * 1e6 * 10000/50) / 10000
     voteValueHive = (rshares / recentClaims) * rewardBalance
     voteValueUsd = voteValueHive * hivePrice
     ```
   - React Query caches results client-side for 5 minutes

### Database Schema

- `users` table - User authentication (id, username, password)
- `hive_prices` table - Historical HIVE price tracking (id, price, timestamp)

PostgreSQL connection via `@neondatabase/serverless` requires `DATABASE_URL` environment variable.

## Styling & Theming

- Tailwind CSS with `darkMode: ["class"]` configuration
- CSS variables defined in `client/src/index.css` for theme values
- Dark theme uses slate color palette (#063248, #0A4F70, #046088 for dark theme)
- Light theme uses blue color palette
- Theme toggle persists choice in localStorage with key `hive-calculator-theme`
- Custom Hive brand colors integrated into Tailwind config

## Translation System

The app supports English/Spanish translations:
- Translation data in `client/src/lib/translations.ts`
- Custom hook `useTranslation` in `client/src/hooks/useTranslation.ts`
- Language toggle with Globe icon in header

## Development Practices

### API Integration
- All external API calls should have timeout protection (5-10 seconds)
- Always implement fallback values for blockchain API failures
- Use AbortController for fetch timeout management
- Log detailed debug information in development mode (`NODE_ENV === 'development'`)

### React Best Practices
- Use `useCallback` to prevent memory leaks
- Manage React Query cache intervals appropriately (5 minutes for price data)
- Avoid unnecessary re-renders by optimizing hook dependencies
- Proper cleanup in useEffect hooks

### Vote Calculation Formula
The vote calculation uses the **official Hive blockchain rshares formula**. When modifying vote calculations:
- Never deviate from the rshares-based formula
- Always fetch real blockchain parameters (don't use hardcoded values)
- Validate all API responses for required fields before parsing
- Expected vote values: 1K HP ≈ $0.009, 10K HP ≈ $0.094, 100K HP ≈ $0.937

## User Preferences

- **Communication style:** Simple, everyday language
- **UI Design:** Dark blue midnight theme with minimal, clean interface showing only essential elements
- **Branding:** Include Aliento Project logo and attribution with link to aliento.blog

## Port Configuration

The application **ALWAYS** runs on port 5000 in both development and production. This port serves:
- The Express API routes (`/api/*`)
- The Vite dev server (in development)
- Static files from `dist/public` (in production)
