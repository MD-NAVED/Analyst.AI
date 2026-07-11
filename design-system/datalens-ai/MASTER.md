# DataLens AI — Design System Master File (v2.0 Light Theme)

> **LOGIC:** When building a specific page, first check `design-system/pages/[page-name].md`.
> If that file exists, its rules **override** this Master file.
> If not, strictly follow the rules below.

---

**Project:** DataLens AI  
**Version:** 2.0 — Light Theme  
**Updated:** 2026-07-10  
**Category:** B2B SaaS Data Analytics Tool  
**Design Dials:** Density 7/10 (Information-Rich Dashboard), Style: Clean Light / Premium SaaS  

> **Dark Mode Note:** Dark mode is NOT active but is structurally supported via CSS custom properties.
> To enable in future: add `[data-theme="dark"]` override block in `src/index.css` and bind a toggle to `document.documentElement.setAttribute('data-theme', 'dark')`.
> No component code changes needed — all colors go through `var(--*)` tokens.

---

## 1. Color Palette

| Role | Hex | CSS Variable | Usage |
|------|-----|--------------|-------|
| Page Background | `#F8FAFC` | `--bg` | Body, app container |
| Surface / Card | `#FFFFFF` | `--surface` | Cards, panels, sidebar |
| Raised Surface | `#F1F5F9` | `--surface-raised` | Hover states, table headers |
| Border Default | `#E2E8F0` | `--border` | All dividers, card edges |
| Border Strong | `#CBD5E1` | `--border-strong` | Section separators |
| Primary Accent | `#3B82F6` | `--primary` | CTA buttons, links, active state |
| Primary End | `#8B5CF6` | `--primary-end` | Gradient end (blue → purple) |
| Success / Growth | `#22C55E` | `--success` | Positive stats, growth badges |
| Warning | `#F59E0B` | `--warning` | Alerts, caution states |
| Danger | `#EF4444` | `--danger` | Errors, destructive actions |
| Text Primary | `#0F172A` | `--text-primary` | Headings, important body |
| Text Secondary | `#475569` | `--text-secondary` | Body text, descriptions |
| Text Muted | `#94A3B8` | `--text-muted` | Captions, labels, placeholders |

**Color Philosophy:**
- Backgrounds are light neutral (not pure white, not grey — the #F8FAFC off-white feels premium)
- The **blue→purple gradient** is the sole accent, used for: primary buttons, active nav items, chart highlights, heading emphasis
- **Green (#22C55E)** is ONLY for positive/growth indicators — never for primary actions
- Avoid mixing warm tones (orange/red) with cool blues unless signaling a state

---

## 2. Typography

| Element | Font | Weight | Size | Notes |
|---------|------|--------|------|-------|
| Heading H1 | Inter | 800 | 2rem | Page titles, hero |
| Heading H2 | Inter | 700 | 1.5rem | Section titles |
| Heading H3 | Inter | 600 | 1.125rem | Card headers |
| Body Default | Inter | 400 | 0.875rem | General content |
| Body Medium | Inter | 500 | 0.875rem | Labels, navigation |
| Body Strong | Inter | 600 | 0.875rem | Emphasis, selected items |
| Caption | Inter | 500 | 0.75rem | Metadata, timestamps |
| Mono / Code | JetBrains Mono | 500–700 | 0.875rem | Numbers, stats, code |

**Google Fonts Import:**
```css
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&family=JetBrains+Mono:wght@400;500;600;700&display=swap');
```

**Typography Rules:**
- All numerical data values → JetBrains Mono
- Gradient text (blue→purple) only on headings or key hero copy — never on body text
- Line height: 1.5 for body, 1.2 for headings, 1.6 for descriptions

---

## 3. Spacing (Dense Dashboard 7/10)

| Token | Value | Usage |
|-------|-------|-------|
| `--space-xs` | `2px` | Inline micro gaps |
| `--space-sm` | `4px` | Icon gaps |
| `--space-md` | `8px` | Standard padding unit |
| `--space-lg` | `12px` | Section internal padding |
| `--space-xl` | `16px` | Card gaps |
| `--space-2xl` | `24px` | Section gaps |
| `--space-3xl` | `32px` | Page-level padding |

Content area padding: `28px 32px`  
Card padding: `20px`  
Compact card padding: `14px 16px`

---

## 4. Shadows

| Level | Value | Usage |
|-------|-------|-------|
| `--shadow-xs` | `0 1px 2px rgba(0,0,0,0.04)` | Buttons, inputs |
| `--shadow-sm` | `0 2px 8px rgba(0,0,0,0.06)` | Cards, sidebar |
| `--shadow-md` | `0 4px 16px rgba(0,0,0,0.08)` | Floating elements |
| `--shadow-lg` | `0 8px 32px rgba(0,0,0,0.10)` | Dropdowns, modals |
| `--shadow-xl` | `0 16px 48px rgba(0,0,0,0.12)` | Landing page cards |

---

## 5. Border Radius

| Token | Value | Usage |
|-------|-------|-------|
| `--radius-sm` | `8px` | Buttons, badges, small elements |
| `--radius-md` | `12px` | Inputs, dropdowns, small cards |
| `--radius-lg` | `16px` | Main cards, modals |
| `--radius-xl` | `20px` | Hero graphics, feature cards |
| `--radius-full` | `9999px` | Pills, tags, avatar circles |

---

## 6. Component Specs

### Buttons

```css
/* Primary — gradient CTA */
.btn-primary {
  background: linear-gradient(135deg, #3B82F6, #8B5CF6);
  color: #FFFFFF;
  border-radius: 12px;
  padding: 10px 20px;
  font-weight: 600;
  box-shadow: 0 2px 8px rgba(59, 130, 246, 0.3);
  transition: all 200ms ease;
}
.btn-primary:hover { transform: translateY(-1px); box-shadow: 0 4px 16px rgba(59, 130, 246, 0.4); }

/* Secondary — outlined */
.btn-secondary {
  background: #FFFFFF;
  border: 1px solid #E2E8F0;
  color: #475569;
  border-radius: 12px;
  padding: 9px 18px;
  font-weight: 500;
}
.btn-secondary:hover { border-color: #3B82F6; color: #3B82F6; background: rgba(59, 130, 246, 0.04); }
```

### Cards

```css
.premium-card {
  background: #FFFFFF;
  border: 1px solid #E2E8F0;
  border-radius: 16px;
  padding: 20px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.06);
  transition: all 200ms ease;
}
.premium-card:hover {
  border-color: #C7D2FE;
  box-shadow: 0 4px 16px rgba(0,0,0,0.08), 0 0 0 1px rgba(59,130,246,0.08);
}
```

### Inputs

```css
.premium-input {
  background: #FFFFFF;
  border: 1.5px solid #E2E8F0;
  border-radius: 12px;
  padding: 9px 13px;
  color: #0F172A;
  font-size: 14px;
  transition: all 180ms ease;
}
.premium-input:focus {
  border-color: #3B82F6;
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.12);
}
```

---

## 7. Data Visualization Colors

For charts (Recharts), use this palette in order:
1. `#3B82F6` — Blue (primary series)
2. `#8B5CF6` — Purple
3. `#22C55E` — Green (growth/positive)
4. `#F59E0B` — Amber
5. `#EC4899` — Pink
6. `#14B8A6` — Teal
7. `#F97316` — Orange

Chart backgrounds: `#F8FAFC`  
Chart axes/grid: `#E2E8F0`  
Tooltip background: `#FFFFFF` with `border: 1px solid #E2E8F0`

---

## 8. Page Layout Rules

### App Shell
- **Sidebar**: 256px wide, white background, 1px right border `#E2E8F0`
- **Top Navbar**: 60px tall, `rgba(248,250,252,0.9)` with `backdrop-filter: blur(12px)`
- **Content Area**: `padding: 28px 32px`, scrollable, gap between sections `20px`

### Section Headers
Each page section should have:
- `<h2>` for the main title (dark slate text)
- Optional subtitle in `var(--text-secondary)`
- Top-right action buttons in `btn-secondary` or `btn-primary`

### Stat / KPI Cards
- White card with very subtle shadow
- Monospaced number in gradient text (blue→purple)
- Small label in `var(--text-muted)` uppercase 10px
- Trend indicator: green for positive, red for negative

---

## 9. Anti-Patterns (FORBIDDEN)

- ❌ **Dark backgrounds** on any dashboard screen (dark theme is disabled)
- ❌ **Green (#22C55E) for primary buttons or navigation** — green is ONLY for positive data indicators
- ❌ **Plain red/blue/green** — always use the design system palette
- ❌ **Emojis as icons** — Use Lucide React icons consistently
- ❌ **Missing `cursor: pointer`** — All clickable elements must have it
- ❌ **Inline style overrides** for colors that conflict with CSS variables
- ❌ **Generic placeholder stats** — e.g. "10K+ Active Users" must never appear in internal app screens
- ❌ **Low contrast** — Maintain 4.5:1 minimum ratio for all text
- ❌ **Instant state changes** — Always use 150–250ms transitions
- ❌ **Layout-shifting hovers** — Avoid scale transforms that shift siblings
- ❌ **Invisible focus states** — Focus ring must be visible for a11y

---

## 10. Pre-Delivery Checklist

Before shipping any UI change, verify:

- [ ] All colors sourced from `var(--*)` tokens — no hardcoded hex in JSX
- [ ] No dark background classes (`bg-slate-900`, `bg-slate-950`, `bg-[#0D1117]`) in light mode screens
- [ ] All buttons use `.btn-primary` or `.btn-secondary` or Tailwind equivalents using the token colors
- [ ] Hover states transition at 150–250ms
- [ ] All Lucide icons used (no emojis)
- [ ] `cursor-pointer` on all clickable elements
- [ ] Focus states visible (input focus ring, button focus)
- [ ] Responsive: 375px, 768px, 1024px, 1440px verified
- [ ] `npm run build` passes with zero errors
- [ ] No broken `var(--*)` references
