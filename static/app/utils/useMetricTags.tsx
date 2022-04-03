import {useEffect} from 'react';

import {fetchMetricsTags} from 'sentry/actionCreators/metrics';
import MetricsTagStore from 'sentry/stores/metricsTagStore';
import PageFiltersStore from 'sentry/stores/pageFiltersStore';
import {useLegacyStore} from 'sentry/stores/useLegacyStore';
import useApi from 'sentry/utils/useApi';

import useOrganization from './useOrganization';

export function useMetricTags() {
  const api = useApi();
  const organization = useOrganization();
  const {selection} = useLegacyStore(PageFiltersStore);
  const {metricsTags, loaded} = useLegacyStore(MetricsTagStore);
  const shouldFetchMetricTags = !loaded;

  useEffect(() => {
    let unmounted = false;

    if (!unmounted && shouldFetchMetricTags) {
      fetchMetricsTags(api, organization.slug, selection.projects);
    }

    return () => {
      unmounted = true;
    };
  }, [selection.projects, organization.slug, shouldFetchMetricTags]);

  return {metricTags: metricsTags};
}
