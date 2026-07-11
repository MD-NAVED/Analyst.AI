# DataLens AI Architecture

This document describes the design boundaries, technology stack, and data flow of DataLens AI.

## Technology Stack

- **Frontend**: React 19, TypeScript, Vite, Vanilla CSS + Tailwind CSS utilities, Recharts (visualizations), motion (animations), PapaParse (CSV parsing), SheetJS (XLSX parsing).
- **Backend / API**: Node.js/Express, hosted as Serverless Functions on Vercel (`api/index.ts`).
- **State Management**: React state. Onboarding answers, session states, and credentials (e.g. JWT) are stored in `localStorage`.
- **Database / Auth (Planned)**: Migrating from local file-based mock authentication (`users.json`) to a managed authentication and database provider (Supabase Auth + PostgreSQL).

---

## Architecture Boundaries

```
┌─────────────────────────────────────────────────────────────────┐
│                           BROWSER (Client)                      │
│                                                                 │
│   ┌───────────────────┐     ┌───────────────────────────────┐   │
│   │   LandingPage     │     │       OnboardingFlow          │   │
│   └─────────┬─────────┘     └───────────────┬───────────────┘   │
│             │                               │                   │
│             └───────────────┬───────────────┘                   │
│                             ▼                                   │
│                     ┌───────────────┐                           │
│                     │    MainApp    │                           │
│                     └───────┬───────┘                           │
│                             ▼                                   │
│                  ┌─────────────────────┐                        │
│                  │  In-Browser Parser  │                        │
│                  │  (PapaParse/XLSX)   │                        │
│                  └─────────────────────┘                        │
└─────────────────────────────┬───────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                        API SERVER (Express)                     │
│                                                                 │
│   ┌───────────────────┐     ┌───────────────────────────────┐   │
│   │    Auth Router    │     │       Gemini AI Router        │   │
│   │   (JWT / Me API)  │     │       (Metadata Prompt)       │   │
│   └───────────────────┘     └───────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

### 1. Frontend Ingestion
- Uploaded CSV and Excel sheets are parsed completely in the browser via `PapaParse` and `xlsx` (SheetJS).
- Raw dataset files are never sent to the server. Data processing is kept strictly local to optimize performance and protect user privacy.

### 2. Authentication Flow
- All user requests use a Bearer token stored in `localStorage` for authorization.
- Expired sessions and session validation checks are handled automatically via API intercepts.

### 3. AI / LLM Boundary
- The client sends only structured metadata (column names, types, general metrics, and a capped, redacted sample) to the server for AI generation.
- Full datasets are never sent to the LLM backend.
