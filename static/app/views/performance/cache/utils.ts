import useOrganization from 'sentry/utils/useOrganization';
import {normalizeUrl} from 'sentry/utils/withDomainRequired';
import {CACHE_BASE_URL} from 'sentry/views/performance/cache/settings';

export const useCacheUrl = () => {
  const {slug} = useOrganization();
  return normalizeUrl(`/organizations/${slug}${CACHE_BASE_URL}`);
};
