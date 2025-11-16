# Hive Upvote Calculator

A full-stack web application that calculates upvote values for Hive blockchain accounts based on their Hive Power. The app fetches real-time HIVE price data and blockchain parameters to provide accurate voting power estimations.

Created by the [Aliento Project](https://aliento.blog) 🚀

## ✨ Features

- **Real-time Vote Calculations** - Uses authentic Hive blockchain rshares formula
- **Live HIVE Price** - Fetches witness price feeds from HAF Explorer API
- **Bilingual Support** - English/Spanish translations with toggle
- **Dark Mode** - Beautiful dark theme with persistent preference
- **Responsive Design** - Clean, minimal interface optimized for all devices
- **Type-Safe** - Full TypeScript coverage across client and server

## 🚀 Quick Start

### Prerequisites

- Node.js 18+ and npm
- PostgreSQL database (local or hosted)
- Basic knowledge of React and Express

### Installation

```bash
# Clone the repository
git clone <repository-url>
cd vote-aliento-blog

# Install dependencies
npm install

# Set up environment variables
cp .env.example .env
# Edit .env and add your DATABASE_URL

# Push database schema
npm run db:push

# Start development server
npm run dev
```

The app will be available at `http://localhost:5000`

## 📋 Available Commands

```bash
# Development
npm run dev          # Start dev server with hot reload on port 5000

# Production
npm run build        # Build client and server for production
npm start            # Run production server

# Database
npm run db:push      # Push Drizzle schema changes to PostgreSQL

# Type Checking
npm run check        # Run TypeScript compiler validation
```

## 🔧 Environment Variables

Create a `.env` file in the root directory:

```env
DATABASE_URL=postgresql://user:password@host:port/database
```

**Required:**
- `DATABASE_URL` - PostgreSQL connection string for Drizzle ORM

## 📁 Project Structure

```
vote-aliento-blog/
├── client/              # React frontend
│   ├── src/
│   │   ├── components/  # React components (shadcn/ui)
│   │   ├── hooks/       # Custom hooks (useTranslation, etc.)
│   │   ├── lib/         # Utilities and query client
│   │   └── pages/       # Route components
│   └── index.html       # HTML entry with meta tags
├── server/              # Express backend
│   ├── index.ts         # Express app setup
│   ├── routes.ts        # API endpoints
│   ├── storage.ts       # Database configuration
│   └── vite.ts          # Vite integration
├── shared/              # Shared TypeScript code
│   └── schema.ts        # Drizzle ORM schemas + Zod validation
└── dist/                # Production build output
```

## 🏛️ Architecture Overview

### Technology Stack

**Frontend:**
- React 18 with TypeScript
- Vite for build tooling and dev server
- shadcn/ui components built on Radix UI primitives
- Tailwind CSS with dark mode and custom theming
- React Query (TanStack Query) for server state (5-min cache)
- Wouter for client-side routing
- React Hook Form with Zod validation

**Backend:**
- Express.js with TypeScript
- RESTful API architecture
- Integration with Hive blockchain APIs and HAF Explorer
- Session-based architecture with memory storage

**Database:**
- Drizzle ORM with PostgreSQL adapter
- @neondatabase/serverless for connectivity
- Schema for users and HIVE price tracking
- Zod validation for type-safe data handling

### API Endpoints

#### `GET /api/hive-price`
Fetches current HIVE price in USD:
1. **Primary**: HAF Explorer witness price feeds (`https://api.syncad.com/hafbe-api/witnesses?limit=1`)
2. **Fallback**: CoinGecko API
3. **Last Resort**: Hardcoded fallback ($0.198)

#### `POST /api/calculate-vote`
Calculates vote value using real blockchain parameters:
- Fetches from `condenser_api.get_dynamic_global_properties` (vesting fund/shares)
- Fetches from `condenser_api.get_reward_fund` (reward balance, recent claims)
- Implements official Hive rshares formula:
  ```
  totalVests = (hivePower * totalVestingShares) / totalVestingFundHive
  rshares = (votePowerFactor * totalVests * 1e6 * 10000/50) / 10000
  voteValueHive = (rshares / recentClaims) * rewardBalance
  voteValueUsd = voteValueHive * hivePrice
  ```

### Key Features

**Translation System:**
- English/Spanish support via `client/src/lib/translations.ts`
- Custom `useTranslation` hook
- Globe icon toggle in header

**Theme System:**
- Dark/light theme with CSS variables
- Dark: Slate palette (#063248, #0A4F70, #046088)
- Light: Blue palette
- Persists in localStorage (`hive-calculator-theme`)

**Path Aliases:**
- `@/*` → `./client/src/*`
- `@shared/*` → `./shared/*`
- `@assets/*` → `./attached_assets/*`

## 📦 Deployment

### Development
- Runs on port **5000** (both API and client)
- Vite dev server with HMR
- Express serves API routes

### Production Build Process

1. **Client Build**: Vite optimizes static assets to `dist/public`
2. **Server Build**: ESBuild bundles server to `dist/index.js`
3. **Run**: Server serves static files from `dist/public` on port 5000

```bash
npm run build
npm start
```

### Port Configuration

⚠️ The application **always** runs on port **5000** in both development and production.

## 🧪 Troubleshooting

### Common Issues

**Database connection errors:**
- Verify `DATABASE_URL` is set correctly in `.env`
- Ensure PostgreSQL is running and accessible
- Run `npm run db:push` to sync schema

**Port 5000 already in use:**
```bash
# Find and kill the process using port 5000
lsof -ti:5000 | xargs kill -9
```

**Type errors:**
```bash
# Run type checking to identify issues
npm run check
```

**Vote calculations return $0:**
- Check Hive blockchain API availability (api.hive.blog)
- Verify network connectivity
- Check browser console for API errors

## 📝 Development Notes

### Vote Calculation Formula

The app uses the **official Hive blockchain rshares formula** for accurate vote value calculations:
- Fetches real-time blockchain parameters (never uses hardcoded values)
- Validates all API responses before parsing
- Expected values: 1K HP ≈ $0.009, 10K HP ≈ $0.094, 100K HP ≈ $0.937

### API Integration Best Practices

- All external API calls have timeout protection (5-10 seconds)
- Fallback values for blockchain API failures
- AbortController for fetch timeout management
- Detailed debug logging in development mode

### React Best Practices

- Use `useCallback` to prevent memory leaks
- React Query cache intervals: 5 minutes for price data
- Optimize hook dependencies to avoid unnecessary re-renders
- Proper cleanup in useEffect hooks

## 🤝 Contributing

Contributions are welcome! Please:
1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License.

## 🙏 Acknowledgments

- Built by the [Aliento Project](https://aliento.blog)
- Powered by the Hive blockchain
- UI components from [shadcn/ui](https://ui.shadcn.com)

---

**Made with ❤️ for the Hive community**
