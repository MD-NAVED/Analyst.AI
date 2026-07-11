import { BrandConfig } from './types';

export async function fetchBrandConfig(brandId: string): Promise<BrandConfig> {
  try {
    const response = await fetch(`/brands/${brandId}.json`);
    if (!response.ok) {
      throw new Error(`Failed to load brand config: ${response.statusText}`);
    }
    return await response.json();
  } catch (error) {
    console.warn(`Could not load brand config for ID "${brandId}", falling back to default.`, error);
    // Fetch default fallback config
    const fallbackResponse = await fetch('/brands/default.json');
    return await fallbackResponse.json();
  }
}

export async function loadBrandConfig(): Promise<BrandConfig> {
  if (typeof window === 'undefined') {
    // Return empty shell during SSR if applicable
    return fetchBrandConfig('default');
  }

  // Strategy A: URL parameter (?brand=acme-corp)
  const urlParams = new URLSearchParams(window.location.search);
  const brandParam = urlParams.get('brand');
  if (brandParam) {
    return fetchBrandConfig(brandParam);
  }

  // Strategy B: Subdomain matching (e.g. acme-corp.datalens.ai)
  const hostname = window.location.hostname;
  const parts = hostname.split('.');
  
  // Exclude localhosts or pure IPs from subdomain parsing
  const isIP = /^(?:[0-9]{1,3}\.){3}[0-9]{1,3}$/.test(hostname);
  const isLocalhost = hostname === 'localhost' || hostname === '127.0.0.1';
  
  if (parts.length > 2 && parts[0] !== 'www' && !isIP && !isLocalhost) {
    const subdomain = parts[0];
    return fetchBrandConfig(subdomain);
  }

  // Strategy C: Environment variable VITE_BRAND_CONFIG_ID set at build
  const envBrandId = import.meta.env.VITE_BRAND_CONFIG_ID;
  if (envBrandId) {
    return fetchBrandConfig(envBrandId);
  }

  // Strategy D: Default fallback
  return fetchBrandConfig('default');
}

export function applyBrandConfig(config: BrandConfig): void {
  if (typeof document === 'undefined') return;

  const root = document.documentElement;

  // 1. Inject colors as global CSS variables
  // Map camelCase JSON keys → kebab-case CSS custom properties
  const camelToKebab = (str: string) =>
    str.replace(/([A-Z])/g, (m) => `-${m.toLowerCase()}`);

  // Explicit key aliases for backward compatibility
  const keyAliases: Record<string, string[]> = {
    bg:            ['--bg'],
    surface:       ['--surface'],
    surfaceHover:  ['--surface-raised', '--surface-hover'],
    surfaceRaised: ['--surface-raised'],
    border:        ['--border'],
    primary:       ['--primary'],
    primaryHover:  ['--primary-hover'],
    accent:        ['--accent'],
    success:       ['--success'],
    warning:       ['--warning'],
    danger:        ['--danger'],
    textPrimary:   ['--text-primary'],
    textSecondary: ['--text-secondary'],
    textMuted:     ['--text-muted'],
  };

  Object.entries(config.colors).forEach(([key, value]) => {
    // Set via alias list if available
    const aliases = keyAliases[key];
    if (aliases) {
      aliases.forEach(alias => root.style.setProperty(alias, value as string));
    }
    // Always also set the raw camelCase → kebab form as fallback
    root.style.setProperty(`--${camelToKebab(key)}`, value as string);
  });

  // 2. Inject typography variables
  root.style.setProperty('--font-family', config.fontFamily);
  root.style.setProperty('--font-mono', config.fontMono);

  // 3. Update HTML title
  document.title = `${config.appName} - ${config.appTagline}`;

  // 4. Update Favicon link
  let faviconLink = document.querySelector('link[rel="icon"]') as HTMLLinkElement;
  if (!faviconLink) {
    faviconLink = document.createElement('link');
    faviconLink.rel = 'icon';
    document.head.appendChild(faviconLink);
  }
  faviconLink.href = config.favicon;
}
