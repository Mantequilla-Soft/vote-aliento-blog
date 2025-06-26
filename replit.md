# Hive Upvote Calculator

## Overview

This is a full-stack web application that calculates upvote values for Hive blockchain accounts based on their Hive Power. The app fetches real-time HIVE price data and provides instant calculations for voting power estimation. Built with a modern tech stack focusing on performance and user experience. Created by the Aliento Project (aliento.blog).

## System Architecture

The application follows a monorepo structure with clear separation between client and server:

**Frontend (React/TypeScript)**
- Built with Vite for fast development and optimized builds
- Uses shadcn/ui component library with Radix UI primitives
- Tailwind CSS for styling with custom Hive brand colors
- React Query (TanStack Query) for state management and API caching
- Wouter for lightweight client-side routing

**Backend (Node.js/Express)**
- Express.js server with TypeScript support
- RESTful API endpoints for HIVE price and vote calculations
- Integration with HAF Explorer API for real-time price data
- Session-based architecture with memory storage

**Database Layer**
- Drizzle ORM configured for PostgreSQL
- Schema definitions for users and HIVE price tracking
- Zod validation for type-safe data handling

## Key Components

### Frontend Architecture
- **Component Structure**: Uses shadcn/ui design system with consistent styling
- **State Management**: React Query handles server state with 5-minute cache intervals
- **Styling**: Tailwind CSS with CSS variables for theming and dark mode support
- **Form Handling**: React Hook Form with Zod resolvers for validation

### Backend Architecture
- **API Layer**: Express routes with middleware for logging and error handling
- **External Integration**: HAF Explorer API client for HIVE price feeds
- **Data Validation**: Zod schemas for request/response validation
- **Error Handling**: Centralized error middleware with proper HTTP status codes

### Data Flow
1. Client requests HIVE price from `/api/hive-price`
2. Server fetches from HAF Explorer API with fallback to cached price
3. Vote calculations performed server-side using HIVE Power input
4. Results cached client-side for 5 minutes to reduce API calls

## External Dependencies

**Core Dependencies:**
- React 18 with TypeScript for type safety
- Express.js for server framework
- Drizzle ORM with PostgreSQL adapter
- @neondatabase/serverless for database connectivity

**UI Libraries:**
- @radix-ui/* components for accessible primitives
- Tailwind CSS for utility-first styling
- Lucide React for consistent iconography

**Development Tools:**
- Vite for build tooling and dev server
- ESBuild for server bundling
- TSX for TypeScript execution

## Deployment Strategy

**Development:**
- Vite dev server on port 5000 with HMR
- Express server serves API routes and static files
- PostgreSQL database provisioned via Replit

**Production:**
- Vite builds optimized static assets to `dist/public`
- ESBuild bundles server code to `dist/index.js`
- Autoscale deployment target with port 80 external mapping
- Environment variables for database connection

**Build Process:**
1. `npm run build` - Builds client and server bundles
2. Client assets served from `/dist/public`
3. Server runs from bundled `/dist/index.js`

## Recent Changes
- June 23, 2025: Built complete Hive vote value calculator with real-time price feeds
- Implemented accurate vote calculation using actual blockchain parameters
- Integrated HAF Explorer API for authentic witness price feeds ($0.201 current price)
- Created responsive Hive-branded interface with example values and detailed explanations
- Fixed critical calculation bug that was returning zero values
- Resolved DOM nesting warnings, memory leaks, and server error handling issues
- Simplified interface to show only essential elements: HP input, HIVE price, and USD vote value
- Applied dark blue midnight theme with slate colors for modern appearance
- Added Aliento Project branding with logo and attribution in header
- **OFFICIAL HIVE DEVELOPERS FORMULA**: Implemented authentic calculation from developers.hive.io
- Formula: final_vest = total_vests × 1e6; power = (voting_power × weight / 10000) / 50; rshares = power × final_vest / 10000; estimate = rshares / recent_claims × reward_balance × hbd_median_price
- Corrected vote values with proper scaling: 1000 HP = ~$0.01, 10000 HP = ~$0.10, 100000 HP = ~$1.00
- Uses authentic APIs: condenser_api.get_reward_fund, get_feed_history, get_dynamic_global_properties
- Real blockchain data: reward balance (~999K HIVE), recent claims (~708B), HBD median price (~0.192)
- Fixed memory leaks in React components with proper useCallback implementation
- Improved API error handling and removed unrealistic fallback values
- **RSHARES-BASED VOTE FORMULA**: Implemented authentic rshares calculation using exact blockchain mechanics
- Uses accurate formula: voteValueHIVE = (rshares / recentClaims) * rewardBalance
- RShares calculated as: rshares = (votePowerFactor * totalVests * 1e6 * 10000/50) / 10000
- Real network values: 1K HP ≈ $0.009, 10K HP ≈ $0.094, 100K HP ≈ $0.937
- Fetches live blockchain data: reward balance, recent claims, vesting fund statistics
- Matches actual Hive blockchain vote calculation methodology
- June 25, 2025: Updated to use user-provided rshares formula for maximum accuracy
- Switched to witness price feeds as primary price source instead of CoinGecko for authentic blockchain pricing
- June 26, 2025: Fixed multiple critical bugs identified in bug check
- Resolved JavaScript hoisting error with debouncedCalculate function causing React crashes
- Enhanced server-side API error handling with proper validation for blockchain data responses
- Fixed blinking vote value issue when using custom prices by optimizing React hook dependencies
- Improved memory management and prevented unnecessary API calls through better caching logic
- Updated visual design with beautiful blue color palette and Inter font inspired by modern UI designs
- Implemented English/Spanish translation system with toggle button in header
- Moved attribution link from header to bottom of interface for cleaner design
- Replaced translation toggle icon from gear/settings to Globe icon for better user intuition

## User Preferences

Preferred communication style: Simple, everyday language.
UI Design: Dark blue midnight theme with minimal, clean interface showing only essential elements.
Branding: Include Aliento Project logo and attribution with link to aliento.blog in the application header.