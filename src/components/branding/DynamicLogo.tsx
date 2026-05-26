import React from 'react';
import { useBrandConfig } from '../../config/useBrandConfig';

export const DynamicLogo: React.FC = () => {
  const { appName, logo, logoWidth } = useBrandConfig();

  // If the logo string is an inline SVG, a data URL, or a valid image path:
  if (logo && (logo.startsWith('/') || logo.startsWith('data:image/') || logo.startsWith('http'))) {
    return (
      <img 
        src={logo} 
        alt={appName} 
        style={{ 
          width: `${logoWidth}px`, 
          height: 'auto', 
          maxHeight: '40px',
          objectFit: 'contain',
          display: 'block'
        }} 
        className="brand-logo transition-transform duration-300 hover:scale-102"
      />
    );
  }

  // Fallback text branding if logo is not a valid image path
  return (
    <div 
      className="brand-logo-fallback flex items-center" 
      style={{ 
        fontWeight: 800, 
        fontSize: '1.25rem', 
        letterSpacing: '-0.025em',
        color: 'var(--text-primary)'
      }}
    >
      {appName}
    </div>
  );
};
