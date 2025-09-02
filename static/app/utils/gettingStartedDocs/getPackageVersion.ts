import type {DocsParams} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {t} from 'sentry/locale';

export const PACKAGE_LOADING_PLACEHOLDER = t('loading\u2026');

export function getPackageVersion(params: DocsParams, name: string, fallback: string) {
  return params.sourcePackageRegistries.isLoading
    ? PACKAGE_LOADING_PLACEHOLDER
    : (params.sourcePackageRegistries.data?.[name]?.version ?? fallback);
}
