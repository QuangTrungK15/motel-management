# NhaTro

A full-stack motel/rental management application built with React Router v7, Prisma, and TailwindCSS.

## Features

- **Dashboard** — Room overview with occupancy stats
- **Rooms** — View and edit room details, rates, and status
- **Tenants** — CRUD with search and unique ID validation (CCCD/CMND/Passport)
- **Contracts** — Move-in/move-out with occupant tracking (max 5 people per room)
- **Payments** — Monthly rent generation, manual entries, mark paid/unpaid
- **Utilities** — Electric and water meter readings with cost calculation
- **Reports** — Monthly income summary with occupancy history
- **Settings** — Motel info, default room rate, utility rates
- **Bilingual** — Vietnamese/English language switching (persisted in localStorage)
- **Dark mode** — Toggle with system preference detection
- **Authentication** — Cookie-based session auth with login/logout
- **Responsive** — Mobile sidebar with hamburger menu

## Tech Stack

- [React Router v7](https://reactrouter.com/) (SSR)
- [Prisma 5](https://www.prisma.io/) + SQLite
- [TailwindCSS v4](https://tailwindcss.com/)
- [Playwright](https://playwright.dev/) (53 E2E tests)
- TypeScript

## Getting Started

```bash
# Install dependencies
npm install

# Set up database
cp .env.example .env
npx prisma db push
npm run db:seed

# Start dev server
npm run dev
```

Default login: `admin` / `admin123`

The app will be available at `http://localhost:5173`.

## Environment Variables

Create a `.env` file:

```
DATABASE_URL="file:./dev.db"
SESSION_SECRET="your-secret-here"  # Required in production
```

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server |
| `npm run build` | Build for production |
| `npm start` | Run production server |
| `npm run db:push` | Apply schema to database |
| `npm run db:seed` | Seed database with 10 rooms and default settings |
| `npm run db:studio` | Open Prisma Studio |
| `npm run test:e2e` | Run E2E tests |
| `npm run test:e2e:ui` | Run E2E tests with UI |

## Project Structure

```
app/
├── components/
│   ├── layout/        # Sidebar, Header, PageContainer
│   └── ui/            # Button, Modal, Table, Badge, etc.
├── lib/
│   ├── auth.server.ts # Cookie-based session authentication
│   ├── db.server.ts   # Prisma client
│   ├── language.tsx    # Language context provider (vi/en)
│   ├── translations.ts# Vietnamese and English translations
│   ├── utils.ts       # Formatting helpers
│   └── validate-id.server.ts # Duplicate ID detection
├── routes/            # Page routes (dashboard, rooms, tenants, etc.)
└── root.tsx           # App shell with dark mode and language support
e2e/                   # Playwright E2E tests (53 tests)
prisma/
├── schema.prisma      # Database schema
└── seed.ts            # Seed script (10 rooms, default settings)
```
