import {useEffect} from 'react';

import {fetchMetricsFields} from 'sentry/actionCreators/metrics';
import MetricsMetaStore from 'sentry/stores/metricsMetaStore';
import PageFiltersStore from 'sentry/stores/pageFiltersStore';
import {useLegacyStore} from 'sentry/stores/useLegacyStore';
import useApi from 'sentry/utils/useApi';

import useOrganization from './useOrganization';

export function useMetricMetas() {
  const api = useApi();
  const organization = useOrganization();
  const {selection} = useLegacyStore(PageFiltersStore);
  const {metricsMeta, loaded} = useLegacyStore(MetricsMetaStore);
  const shouldFetchMetricsMeta = !loaded;

  useEffect(() => {
    let unmounted = false;

    if (!unmounted && shouldFetchMetricsMeta) {
      fetchMetricsFields(api, organization.slug, selection.projects);
    }

    return () => {
      unmounted = true;
    };
  }, [selection.projects, organization.slug, shouldFetchMetricsMeta]);

  return {metricMetas: metricsMeta};
}
