import React, { createContext, useContext, useState, useEffect } from 'react';
import { BrandConfig } from './types';
import { loadBrandConfig, applyBrandConfig } from './loadBrandConfig';
import { BrandLoader } from '../components/branding/BrandLoader';

export interface BrandContextType {
  config: BrandConfig | null;
  loading: boolean;
}

export const BrandContext = createContext<BrandContextType>({
  config: null,
  loading: true
});

export const BrandConfigProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [config, setConfig] = useState<BrandConfig | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function initializeBrand() {
      try {
        const brandConfig = await loadBrandConfig();
        setConfig(brandConfig);
        applyBrandConfig(brandConfig);
      } catch (error) {
        console.error('Failed to load brand configuration:', error);
      } finally {
        setLoading(false);
      }
    }
    initializeBrand();
  }, []);

  if (loading || !config) {
    return <BrandLoader />;
  }

  return (
    <BrandContext.Provider value={{ config, loading }}>
      {children}
    </BrandContext.Provider>
  );
};
