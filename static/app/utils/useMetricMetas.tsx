import {useEffect} from 'react';

import {addErrorMessage} from 'sentry/actionCreators/indicator';
import {t} from 'sentry/locale';
import MetricsMetaStore from 'sentry/stores/metricsMetaStore';
import PageFiltersStore from 'sentry/stores/pageFiltersStore';
import {useLegacyStore} from 'sentry/stores/useLegacyStore';
import handleXhrErrorResponse from 'sentry/utils/handleXhrErrorResponse';
import useApi from 'sentry/utils/useApi';

import useOrganization from './useOrganization';

export function useMetricMetas() {
  const api = useApi();
  const organization = useOrganization();
  const {selection} = useLegacyStore(PageFiltersStore);
  const {metricsMeta, isFetching} = useLegacyStore(MetricsMetaStore);

  useEffect(() => {
    let unmounted = false;

    if (!unmounted) {
      fetchMetricMetas();
    }

    return () => {
      unmounted = true;
    };
  }, [selection.projects, organization.slug]);

  async function fetchMetricMetas() {
    if (isFetching) {
      return;
    }

    MetricsMetaStore.reset();
    try {
      const metas = await api.requestPromise(
        `/organizations/${organization.slug}/metrics/meta/`,
        {
          query: {
            project: selection.projects,
          },
        }
      );
      MetricsMetaStore.onLoadSuccess(metas);
    } catch (error) {
      const errorResponse = error?.responseJSON ?? t('Unable to fetch metric metas');
      addErrorMessage(errorResponse);
      handleXhrErrorResponse(errorResponse)(error);
    }
  }

  return {metricMetas: metricsMeta};
}
