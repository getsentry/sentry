import {DocsParams} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {t} from 'sentry/locale';

export function getPackageVersion(params: DocsParams, name: string, fallback: string) {
  return params.sourcePackageRegistries.isLoading
    ? t('loading\u2026')
    : params.sourcePackageRegistries.data?.[name]?.version ?? fallback;
}
