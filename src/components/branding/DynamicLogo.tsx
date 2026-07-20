import React from 'react';
import { useBrandConfig } from '../../config/useBrandConfig';

/* AnalystAiLogo — renders the brand mark inline as SVG for pixel-perfect crispness.
   On mobile (<640px) only the gradient icon square is shown.
   On desktop the full lockup (icon + wordmark) is shown. */
const AnalystAiInlineLogo: React.FC<{ size?: number }> = ({ size = 36 }) => {
  const iconW = size;
  const iconH = size;
  const rx = Math.round(size * 0.22);
  // Bar dimensions proportional to icon size
  const pad = Math.round(size * 0.20);
  const barW = Math.round(size * 0.145);
  const gap = Math.round(size * 0.065);
  const b1x = pad;
  const b2x = pad + barW + gap;
  const b3x = pad + (barW + gap) * 2;
  const bottom = Math.round(size * 0.76);
  const b1h = Math.round(size * 0.30);
  const b2h = Math.round(size * 0.46);
  const b3h = Math.round(size * 0.58);
  const barRx = Math.max(2, Math.round(size * 0.04));

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox={`0 0 ${iconW} ${iconH}`}
      width={iconW}
      height={iconH}
      style={{ display: 'block', flexShrink: 0, minWidth: Math.max(24, iconW) }}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="analystai-bg" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#4F7CFF" />
          <stop offset="100%" stopColor="#8A5CF6" />
        </linearGradient>
      </defs>
      <rect x="0" y="0" width={iconW} height={iconH} rx={rx} ry={rx} fill="url(#analystai-bg)" />
      {/* Short bar */}
      <rect x={b1x} y={bottom - b1h} width={barW} height={b1h} rx={barRx} ry={barRx} fill="white" />
      {/* Medium bar */}
      <rect x={b2x} y={bottom - b2h} width={barW} height={b2h} rx={barRx} ry={barRx} fill="white" />
      {/* Tall bar */}
      <rect x={b3x} y={bottom - b3h} width={barW} height={b3h} rx={barRx} ry={barRx} fill="white" />
    </svg>
  );
};

export const DynamicLogo: React.FC = () => {
  const { appName, logo } = useBrandConfig();

  // If this is the new Analyst.Ai brand, render the precise inline SVG
  const isAnalystAiBrand = logo === '/analyst-ai-logo.svg' || appName === 'Analyst.Ai';

  if (isAnalystAiBrand) {
    return (
      <div
        className="analyst-ai-logo flex items-center select-none"
        style={{ gap: '10px', padding: '2px 0' }}
        role="img"
        aria-label="Analyst.Ai"
      >
        <AnalystAiInlineLogo size={36} />
        {/* Wordmark: hidden on mobile, shown on sm+ */}
        <span
          className="analyst-ai-wordmark"
          style={{
            display: 'flex',
            alignItems: 'baseline',
            gap: 0,
            fontFamily: "'Inter', 'Segoe UI', Arial, system-ui, sans-serif",
            fontWeight: 500,
            fontSize: '1.2rem',
            lineHeight: 1,
            letterSpacing: '-0.02em',
          }}
        >
          <span style={{ color: '#1A1A2E' }}>Analyst</span>
          <span style={{ color: '#6A5CF6' }}>.Ai</span>
        </span>
      </div>
    );
  }

  // If logo is an image path or URL, render as img
  if (logo && (logo.startsWith('/') || logo.startsWith('data:image/') || logo.startsWith('http'))) {
    return (
      <div className="flex items-center gap-3 select-none">
        <img
          src={logo}
          alt={appName}
          style={{
            width: '26px',
            height: '26px',
            objectFit: 'contain',
            display: 'block'
          }}
          className="brand-logo transition-transform duration-300 hover:scale-105"
        />
        <span
          style={{
            fontWeight: 800,
            fontSize: '1.15rem',
            letterSpacing: '-0.025em',
            color: 'var(--text-primary)',
            lineHeight: 1
          }}
        >
          {appName}
        </span>
      </div>
    );
  }

  // Fallback text branding
  return (
    <div
      className="brand-logo-fallback flex items-center select-none"
      style={{
        fontWeight: 800,
        fontSize: '1.15rem',
        letterSpacing: '-0.025em',
        color: 'var(--text-primary)'
      }}
    >
      {appName}
    </div>
  );
};
