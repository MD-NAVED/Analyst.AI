import React from 'react';
import { useBrandConfig } from '../../config/useBrandConfig';
import { BrandFeatures } from '../../config/types';
import { Lock, Mail, Phone } from 'lucide-react';

interface FeatureGateProps {
  feature: keyof BrandFeatures;
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

export const FeatureGate: React.FC<FeatureGateProps> = ({ feature, children, fallback }) => {
  const { hasFeature, config } = useBrandConfig();

  if (hasFeature(feature)) {
    return <>{children}</>;
  }

  if (fallback) {
    return <>{fallback}</>;
  }

  // Premium, visually stunning lock screen
  return (
    <div className="flex-1 flex flex-col justify-center items-center p-8 text-center bg-[var(--surface)] border border-[var(--border)] rounded-xl relative overflow-hidden min-h-[400px]">
      <div className="absolute inset-0 pointer-events-none opacity-5" style={{ background: 'radial-gradient(circle at center, var(--primary), transparent 60%)' }}></div>
      
      <div 
        className="w-16 h-16 rounded-full flex items-center justify-center mb-6"
        style={{
          background: 'rgba(239, 68, 68, 0.1)',
          border: '1px solid rgba(239, 68, 68, 0.2)',
          color: 'var(--danger)',
          boxShadow: '0 0 20px rgba(239, 68, 68, 0.05)'
        }}
      >
        <Lock size={28} />
      </div>

      <h3 className="text-xl font-bold mb-2 text-white">Module Unavailable</h3>
      <p className="text-sm text-muted max-w-md mb-8">
        This feature has been disabled or is not included in your current subscription tier. Please contact your system administrator to enable this module.
      </p>

      <div className="p-4 bg-[var(--bg)] border border-[var(--border)] rounded-lg w-full max-w-sm text-xs text-left flex flex-col gap-2.5">
        <div className="font-semibold text-white uppercase tracking-wider text-[10px] opacity-70 mb-1">
          {config.client.name} Support
        </div>
        {config.client.supportEmail && (
          <div className="flex items-center gap-2 text-muted">
            <Mail size={13} className="text-[var(--primary)]" />
            <a href={`mailto:${config.client.supportEmail}`} className="hover:text-white transition-colors">{config.client.supportEmail}</a>
          </div>
        )}
        {config.client.supportPhone && (
          <div className="flex items-center gap-2 text-muted">
            <Phone size={13} className="text-[var(--primary)]" />
            <span className="font-mono">{config.client.supportPhone}</span>
          </div>
        )}
      </div>
    </div>
  );
};
