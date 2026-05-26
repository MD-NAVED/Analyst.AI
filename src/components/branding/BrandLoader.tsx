import React from 'react';

export const BrandLoader: React.FC = () => {
  return (
    <div 
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: '#070B14',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999,
        fontFamily: 'system-ui, sans-serif'
      }}
    >
      <div 
        style={{
          width: '64px',
          height: '64px',
          borderRadius: '16px',
          background: 'linear-gradient(135deg, #6366F1 0%, #8B5CF6 100%)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: '0 0 30px rgba(99, 102, 241, 0.4)',
          marginBottom: '20px',
          animation: 'pulse-glow 2s infinite ease-in-out'
        }}
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ width: '32px', height: '32px' }}>
          <circle cx="11" cy="11" r="8" />
          <line x1="21" y1="21" x2="16.65" y2="16.65" />
          <path d="M11 8v6M8 11v3M14 9v5" />
        </svg>
      </div>
      <div 
        style={{
          fontSize: '18px',
          fontWeight: 700,
          color: '#F1F5F9',
          letterSpacing: '0.05em',
          textTransform: 'uppercase',
          marginBottom: '8px'
        }}
      >
        Loading Intelligence
      </div>
      <div style={{ fontSize: '12px', color: '#94A3B8' }}>
        Setting up your customized analytics session...
      </div>
      
      {/* Dynamic Keyframe Injection */}
      <style>{`
        @keyframes pulse-glow {
          0%, 100% { transform: scale(1); opacity: 0.9; box-shadow: 0 0 30px rgba(99, 102, 241, 0.4); }
          50% { transform: scale(1.08); opacity: 1; box-shadow: 0 0 50px rgba(99, 102, 241, 0.6); }
        }
      `}</style>
    </div>
  );
};
