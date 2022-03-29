import {useEffect} from 'react';

import {addErrorMessage} from 'sentry/actionCreators/indicator';
import {t} from 'sentry/locale';
import MetricsTagStore from 'sentry/stores/metricsTagStore';
import PageFiltersStore from 'sentry/stores/pageFiltersStore';
import {useLegacyStore} from 'sentry/stores/useLegacyStore';
import handleXhrErrorResponse from 'sentry/utils/handleXhrErrorResponse';
import useApi from 'sentry/utils/useApi';

import useOrganization from './useOrganization';

export function useMetricTags() {
  const api = useApi();
  const organization = useOrganization();
  const {selection} = useLegacyStore(PageFiltersStore);
  const {metricsTags, isFetching} = useLegacyStore(MetricsTagStore);

  useEffect(() => {
    let unmounted = false;

    if (!unmounted) {
      fetchMetricTags();
    }

    return () => {
      unmounted = true;
    };
  }, [selection.projects, organization.slug]);

  async function fetchMetricTags() {
    if (isFetching) {
      return;
    }
    MetricsTagStore.reset();
    try {
      const tags = await api.requestPromise(
        `/organizations/${organization.slug}/metrics/tags/`,
        {
          query: {
            project: selection.projects,
          },
        }
      );
      MetricsTagStore.onLoadSuccess(tags);
    } catch (error) {
      const errorResponse = error?.responseJSON ?? t('Unable to fetch metric tags');
      addErrorMessage(errorResponse);
      handleXhrErrorResponse(errorResponse)(error);
    }
  }

  return {metricTags: metricsTags};
}
