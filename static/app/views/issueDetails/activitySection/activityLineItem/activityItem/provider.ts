import {t} from 'sentry/locale';

export function getProviderName(provider: null | string | undefined) {
  const normalized = provider?.toLowerCase();

  if (!normalized || normalized === 'unknown' || normalized === 'unknown provider') {
    return t('Git provider');
  }
  if (normalized.includes('github')) {
    return t('GitHub');
  }
  if (normalized.includes('gitlab')) {
    return t('GitLab');
  }
  if (normalized.includes('bitbucket')) {
    return t('Bitbucket');
  }
  return provider;
}
