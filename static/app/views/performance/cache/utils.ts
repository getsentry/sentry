import type {Series} from 'sentry/types/echarts';
import useOrganization from 'sentry/utils/useOrganization';
import {normalizeUrl} from 'sentry/utils/withDomainRequired';
import {CACHE_BASE_URL} from 'sentry/views/performance/cache/settings';

export const convertHitRateToMissRate = (hitRateSeries: Series): Series => {
  return {
    ...hitRateSeries,
    seriesName: 'cache_miss_rate()', // TODO - this can just be a discover function
    data: hitRateSeries.data.map(dataPoint => ({
      ...dataPoint,
      value: dataPoint.value ? 1 - dataPoint.value : 0,
    })),
  };
};

export const useCacheUrl = () => {
  const {slug} = useOrganization();
  return normalizeUrl(`/organizations/${slug}${CACHE_BASE_URL}`);
};
