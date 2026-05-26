import React, { useEffect } from 'react';
import { useBrandConfig } from '../../config/useBrandConfig';

export const DynamicFavicon: React.FC = () => {
  const { favicon } = useBrandConfig();

  useEffect(() => {
    if (typeof document === 'undefined') return;

    let link = document.querySelector("link[rel*='icon']") as HTMLLinkElement;
    if (!link) {
      link = document.createElement('link');
      link.rel = 'icon';
      document.head.appendChild(link);
    }
    link.href = favicon;
  }, [favicon]);

  return null;
};
