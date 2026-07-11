import React from 'react';
import { useBrandConfig } from '../../config/useBrandConfig';

export const DynamicLogo: React.FC = () => {
  const { appName, logo, logoWidth } = useBrandConfig();

  // If the logo string is an inline SVG, a data URL, or a valid image path:
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

  // Fallback text branding if logo is not a valid image path
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
