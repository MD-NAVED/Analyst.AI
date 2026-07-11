# DataLens AI — Simplification & Production Readiness Plan

## Purpose

Transform DataLens AI from a feature-rich prototype into a secure, clear product that helps a user go from spreadsheet to useful insight in a few minutes.

This document is written as an implementation brief for an IDE agent. Follow the phases in order. Do not begin later phases until the acceptance criteria for the current phase pass.

## Product direction

**Core promise:** “Upload a spreadsheet, understand it in 60 seconds.”

The primary journey must be:

1. Upload a file or open a sample dataset.
2. Review a small number of recommended cleanup actions.
3. See the key metrics, insights, and recommended charts.
4. Export or share the result.

Everything else is secondary. Dashboard building, detailed chart configuration, EDA, chat, branding controls, and settings should not compete with the primary journey.

## Goals

- Make the first meaningful result achievable in three clear steps.
- Make public deployment safe: persistent users, secure passwords, real OAuth, no default secrets.
- Restore a clean TypeScript and production validation baseline.
- Reduce initial page weight and split the current monolithic UI into maintainable screens.
- Keep local-first file processing where possible, while making AI data sharing explicit.

## Non-goals for this release

- Do not add team collaboration, billing, or a complex permissions system.
- Do not redesign every existing dashboard/chart capability.
- Do not move uploaded source files to a server unless a later feature explicitly requires it.
- Do not silently remove existing functionality; place advanced functions behind an “Advanced tools” entry point.

## Current technical baseline

- Frontend: React 19, Vite, TypeScript, Tailwind CSS.
- Backend: Express server used locally and as a Vercel function.
- Data processing: browser-side PapaParse and SheetJS.
- AI: server-side Gemini request endpoint.
- Current technical risks:
  - TypeScript validation fails, although the Vite build passes.
  - Authentication uses a local `users.json` file and insecure fallback secrets.
  - Email verification is UI-only.
  - `LandingPage.tsx` exists but is not used.
  - `App.tsx` contains several screens and duplicate chart code in one very large file.
  - Several brand config fields are declarative only and have no runtime effect.

---

## Phase 0 — Safe baseline and delivery rules

### Tasks

1. Preserve all existing user changes. Do not reset, overwrite, or reformat unrelated files.
2. Add CI scripts for `typecheck`, `build`, and tests.
3. Add a lightweight test dataset under `public/samples/` that contains no personal data.
4. Add a short `docs/ARCHITECTURE.md` describing frontend, API, auth, storage, and AI boundaries.
5. Record before/after bundle sizes in the pull request or implementation report.

### Required scripts

```json
{
  "typecheck": "tsc --noEmit",
  "build": "npm run typecheck && vite build && ...",
  "test": "<chosen test runner>",
  "test:e2e": "<chosen browser test runner>"
}
```

### Acceptance criteria

- `npm run typecheck` exits with code 0.
- `npm run build` includes type checking and exits with code 0.
- No API keys, tokens, or real user data are introduced into the repository.

---

## Phase 1 — Fix correctness and remove dead paths

### Tasks

1. Fix all current TypeScript errors.
   - Add Vite client typing so `import.meta.env` is correctly typed.
   - Correct the chart-data types passed to Recharts.
   - Correct `DynamicFavicon` to read the favicon from the available brand config shape.
2. Remove or integrate dead UI paths.
   - Render `LandingPage` for unauthenticated visitors.
   - Remove the unused legacy auth component if the onboarding auth screen replaces it.
   - Keep only one reusable `ChartWidget` implementation; delete or consolidate duplicates.
3. Replace fake email verification.
   - For this release, remove the verification screen and resend control entirely.
   - Do not claim an email has been sent until a real email provider is implemented.
4. Audit all configured brand flags.
   - Either implement each setting or remove it from JSON/types.
   - Enforce `pdfExport`, `excelExport`, `maxFileSizeMB`, `defaultTab`, and `enableTour` where applicable.

### Acceptance criteria

- The landing page is the public entry point.
- The sign-up flow contains no fake verification action.
- Changing a supported brand config changes the corresponding visible behavior.
- There is no duplicate chart-widget implementation.

---

## Phase 2 — Simplify the user experience

### Information architecture

Replace the current many-tab-first experience with the following structure:

| Area | Purpose | Visibility |
| --- | --- | --- |
| Upload | Upload or open a sample dataset | Primary |
| Prepare | Review data quality and recommended cleanup | Primary |
| Insights | KPIs, findings, and recommended charts | Primary |
| Export | PDF, spreadsheet, chart image | Primary action in Insights |
| Advanced tools | Explore data, custom charts, dashboard builder, AI chat | Secondary |

### Tasks

1. Use the landing page with two CTAs:
   - **Try a sample dataset** — no account required.
   - **Upload my data** — ask for sign-in only when necessary, or clearly explain why it is required.
2. Build a three-step progress indicator: Upload → Prepare → Insights.
3. Rename jargon:
   - “Magic Wand” / “Auto-Pilot” → “Analyze my data”.
   - “EDA” → “Explore data”.
   - “Preview” → “Data preview”.
4. On upload, immediately show:
   - row and column count;
   - data-quality summary;
   - up to five recommended cleanup actions;
   - one primary button: **Apply recommendations**;
   - Undo / review details as secondary controls.
5. On Insights, show the default result before exposing controls:
   - 3–5 KPIs;
   - 3 written findings with plain language and supporting columns;
   - 2–3 recommended charts;
   - an export button.
6. Move custom dashboard, detailed chart settings, and chat behind an **Advanced tools** menu.
7. Add empty states and help text for all primary screens.

### UX constraints

- Do not show more than one primary CTA per screen.
- Avoid technical labels unless a user opens Advanced tools.
- Keep the sample workflow fully usable without Gemini credentials.
- Preserve undo before any destructive cleaning operation.

### Acceptance criteria

- A new user can load the sample data and reach Insights in three actions or fewer.
- A new user can identify the next action without reading a manual.
- Advanced capabilities remain available but do not dominate initial navigation.

---

## Phase 3 — Secure, persistent authentication

### Implementation decision

Use a managed authentication and database provider rather than extending file-based authentication. Preferred baseline: **Supabase Auth + Postgres** (email/password and Google OAuth). An equivalent managed provider is acceptable if it provides the same security and persistence properties.

### Tasks

1. Remove `users.json`, custom password hashing, custom JWT creation, and fallback JWT secrets.
2. Add managed auth with:
   - email/password registration and login;
   - Google OAuth using authorization-code flow with PKCE;
   - session validation on protected API requests;
   - logout and expired-session handling.
3. Store only necessary profile/onboarding data in Postgres.
4. Require all secrets through environment variables. Fail startup/deployment clearly when required server secrets are absent.
5. Use secure, HTTP-only session cookies when compatible with the chosen auth provider; avoid storing long-lived access tokens in `localStorage`.
6. Add auth rate limiting and clear, generic login errors.

### Required environment documentation

Update `.env.example` with placeholders only. Include variables for the database/auth provider, Gemini, application URL, and allowed origins.

### Acceptance criteria

- Registrations persist across server restarts and Vercel deployments.
- No password hashes or user records are written to the local filesystem.
- There is no hard-coded production secret or fallback JWT secret.
- Google sign-in uses the provider-supported secure flow.

---

## Phase 4 — Data privacy and AI reliability

### Tasks

1. Add a visible data-use notice before the first AI request:
   - explain that a limited dataset summary/sample may be sent to Gemini;
   - link to the privacy policy;
   - allow the user to continue without AI features.
2. Send the smallest useful dataset representation to Gemini:
   - column names and inferred types;
   - summary statistics;
   - a capped, redacted sample;
   - never the full file by default.
3. Add configurable PII detection/redaction for likely emails, phone numbers, IDs, and addresses before AI submission.
4. Validate Gemini output with a strict schema before rendering it.
5. Provide an understandable fallback when AI is unavailable: calculated stats plus non-AI cleaning suggestions.
6. Keep server-side rate limits, but use a shared store if deploying across multiple serverless instances.

### Acceptance criteria

- Users know what data is sent to AI before it happens.
- AI failure never blocks manual data exploration or export.
- Malformed AI responses cannot break the Insights screen.

---

## Phase 5 — Refactor for maintainability and performance

### Target structure

```text
src/
  app/
    AppShell.tsx
    routes.tsx
  features/
    auth/
    onboarding/
    upload/
    prepare/
    insights/
    explore/
    dashboard/
    chat/
    export/
  components/
    ui/
    branding/
  lib/
    data/
    ai/
    storage/
  config/
```

### Tasks

1. Split `App.tsx` by feature. Keep orchestration in `AppShell` only.
2. Move parsing, type detection, calculations, cleaning operations, and export logic into typed utility modules.
3. Add unit tests for:
   - CSV/JSON/XLSX validation;
   - type detection;
   - cleaning operations and undo;
   - PII redaction;
   - AI response schema parsing.
4. Lazy-load heavy, non-primary features:
   - SheetJS/XLSX;
   - PDF generation;
   - chart/dashboard builder;
   - AI chat.
5. Set up manual chunks and inspect the production bundle.
6. Replace the current XOR “encryption” for IndexedDB data with either no security claim or real Web Crypto encryption backed by a user-controlled/session-derived key.

### Performance targets

- Keep the initial JavaScript bundle below 500 KB gzipped where practical.
- Defer PDF, workbook, dashboard, and chat code until requested.
- Preserve the 100 MB / 500,000-row guardrails and make them configurable through brand configuration.

### Acceptance criteria

- `App.tsx` is an orchestration component, not a multi-screen implementation file.
- Main user flow loads without PDF, dashboard, or chat code.
- Unit tests cover critical data transformations.

---

## Phase 6 — QA, accessibility, and release

### Required automated coverage

1. End-to-end test: guest opens sample data → applies recommendations → sees insights → exports a report.
2. End-to-end test: user registers/logs in → uploads CSV → sees preview → logs out.
3. End-to-end test: Gemini unavailable → user still sees local analysis fallback.
4. Test at desktop and mobile breakpoints.
5. Test branded URLs / `?brand=` configuration with one enabled and one disabled feature.

### Accessibility checklist

- Keyboard-operable navigation, dialogs, drag/drop alternative, and chart export controls.
- Visible focus states and correct labels for inputs/buttons.
- Do not rely on color alone for warnings, quality scores, or errors.
- Respect reduced-motion preferences.
- Maintain readable contrast in both default and client brand themes.

### Release checklist

- `npm run typecheck`, `npm test`, `npm run build`, and e2e tests pass.
- Environment variables configured in deployment provider.
- Auth redirect URLs configured for local and production domains.
- Error monitoring and structured API logging configured without recording sensitive dataset values.
- Privacy policy and AI data-use notice reviewed.

---

## Recommended implementation order

1. Phase 0 and Phase 1 — establish correctness and remove misleading UI.
2. Phase 2 — deliver the simplified product experience.
3. Phase 3 — complete before any public deployment.
4. Phase 4 — complete before enabling AI for customer data.
5. Phase 5 — refactor incrementally while retaining behavior.
6. Phase 6 — required before release.

## Definition of done

The work is complete when a user can safely open a sample or upload data, get understandable findings with minimal effort, export a result, and use the product without encountering dead controls, broken types, insecure authentication, or unexplained AI data sharing.
