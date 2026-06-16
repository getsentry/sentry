import type {
  BasePlatformOptions,
  DocsParams,
} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {t} from 'sentry/locale';

export enum Runtime {
  NODE = 'node',
  CLOUDFLARE = 'cloudflare',
  BUN = 'bun',
  DENO = 'deno',
}

export const platformOptions = {
  runtime: {
    label: t('Runtime'),
    items: [
      {
        label: t('Cloudflare Workers'),
        value: Runtime.CLOUDFLARE,
      },
      {
        label: t('Node'),
        value: Runtime.NODE,
      },
      {
        label: t('Bun'),
        value: Runtime.BUN,
      },
      {
        label: t('Deno'),
        value: Runtime.DENO,
      },
    ],
    defaultValue: Runtime.CLOUDFLARE,
  },
} satisfies BasePlatformOptions;

export type PlatformOptions = typeof platformOptions;
export type Params = DocsParams<PlatformOptions>;
