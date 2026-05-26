import { useContext } from 'react';
import { BrandContext } from './brandContext';
import { BrandConfig, BrandFeatures } from './types';

export function useBrandConfig() {
  const { config, loading } = useContext(BrandContext);

  if (!config) {
    throw new Error('useBrandConfig must be used within a BrandConfigProvider');
  }

  const hasFeature = (featureName: keyof BrandFeatures): boolean => {
    return config.features[featureName] ?? false;
  };

  return {
    config,
    loading,
    appName: config.appName,
    appTagline: config.appTagline,
    logo: config.logo,
    logoWidth: config.logoWidth,
    colors: config.colors,
    ui: config.ui,
    client: config.client,
    hasFeature
  };
}
