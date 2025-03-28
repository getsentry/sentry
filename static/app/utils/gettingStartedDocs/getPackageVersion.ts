import type {DocsParams} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {t} from 'sentry/locale';

export function getPackageVersion(params: DocsParams, name: string, fallback: string) {
  // Completely defensive check for the entire chain of properties
  if (!params?.sourcePackageRegistries) {
    return fallback;
  }

  if (params.sourcePackageRegistries.isLoading) {
    return t('loading\u2026');
  }

  if (!params.sourcePackageRegistries.data) {
    return fallback;
  }

  return params.sourcePackageRegistries.data[name]?.version ?? fallback;
}
