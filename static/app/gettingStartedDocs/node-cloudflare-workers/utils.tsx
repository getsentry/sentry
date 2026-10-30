import type {
  BasePlatformOptions,
  DocsParams,
} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {t} from 'sentry/locale';

// The date whose Cloudflare runtime defaults the snippets opt into. Today's date
// gives a new project the newest defaults, and any date from 2024-09-23 on gives
// `nodejs_compat` the full Node.js API surface the SDK needs.
export const getCompatibilityDate = () => new Date().toISOString().slice(0, 10);

export enum CloudflareSetupType {
  VITE = 'vite',
  MANUAL = 'manual',
  PAGES = 'pages',
}

export const platformOptions = {
  setupType: {
    label: t('Setup Type'),
    defaultValue: CloudflareSetupType.VITE,
    items: [
      {
        label: t('Workers (Vite Plugin)'),
        value: CloudflareSetupType.VITE,
      },
      {
        label: t('Workers (Manual)'),
        value: CloudflareSetupType.MANUAL,
      },
      {
        label: t('Pages'),
        value: CloudflareSetupType.PAGES,
      },
    ],
  },
} satisfies BasePlatformOptions;

export type PlatformOptions = typeof platformOptions;
export type Params = DocsParams<PlatformOptions>;

export function isViteSetup(params: Params) {
  return params.platformOptions.setupType === CloudflareSetupType.VITE;
}

export function isPagesSetup(params: Params) {
  return params.platformOptions.setupType === CloudflareSetupType.PAGES;
}
