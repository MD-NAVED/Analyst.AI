export interface BrandColors {
  primary: string;
  primaryHover: string;
  accent: string;
  success: string;
  warning: string;
  danger: string;
  bg: string;
  surface: string;
  surfaceHover: string;
  border: string;
  textPrimary: string;
  textSecondary: string;
  textMuted: string;
}

export interface BrandFeatures {
  chat: boolean;
  dashboard: boolean;
  autoAnalyst: boolean;
  pdfExport: boolean;
  excelExport: boolean;
  dataCleaning: boolean;
}

export interface BrandUI {
  sidebarDefaultOpen: boolean;
  showGithubLink: boolean;
  showPoweredBy: boolean;
  defaultTab: string;
  maxFileSizeMB: number;
  chartAnimationDuration: number;
  enableTour: boolean;
}

export interface ClientInfo {
  id: string;
  name: string;
  supportEmail: string;
  supportPhone: string;
  customDomain: string;
}

export interface BrandConfig {
  appName: string;
  appTagline: string;
  favicon: string;
  logo: string;
  logoWidth: number;
  colors: BrandColors;
  fontFamily: string;
  fontMono: string;
  features: BrandFeatures;
  ui: BrandUI;
  client: ClientInfo;
  components?: {
    customHero?: {
      title: string;
      subtitle: string;
      ctaText: string;
    };
  };
}
