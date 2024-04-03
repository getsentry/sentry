import type {PageFilters} from 'sentry/types';
import {getMetricsQueryApiRequestPayload} from 'sentry/utils/metrics/useMetricsQuery';
import {useApiQuery} from 'sentry/utils/queryClient';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';

import type {MetricsQueryApiResponse} from '../../types/metrics';
import type {UsageSeries} from '../../views/organizationStats/types';

const METRIC_STATS_MRI = 'c:metric_stats/volume@none';
const OUTCOME_METRIC_TAG = 'outcome.id';
const OUTCOME_STATS_TAG = 'outcome';
const OUTCOME_FIELD = 'sum(quantity)';
const QUERY_NAME = 'query_1';

// https://github.com/getsentry/relay/blob/master/relay-server/src/services/outcome.rs#L73
const OUTCOME_ID_MAP = {
  '0': 'accepted',
  '1': 'errored',
  '2': 'filtered',
  '3': 'rate_limited',
  '4': 'invalid',
  '5': 'aborted',
  '6': 'client_discard',
};

export function getMetricsStatsRequest(pageFilters: PageFilters) {
  return getMetricsQueryApiRequestPayload(
    [
      {
        name: QUERY_NAME,
        mri: METRIC_STATS_MRI,
        op: 'sum',
        groupBy: [OUTCOME_METRIC_TAG],
      },
    ],
    pageFilters
  );
}

export function convertToStatsResponse(response: MetricsQueryApiResponse): UsageSeries {
  const groups = (response.data[0] || []).map(group => {
    return {
      by: {
        [OUTCOME_STATS_TAG]: OUTCOME_ID_MAP[group.by[OUTCOME_METRIC_TAG]] ?? '<unknown>',
      },
      series: {
        [OUTCOME_FIELD]: group.series as number[],
      },
      totals: {
        [OUTCOME_FIELD]: group.totals,
      },
    };
  });

  return {
    groups,
    start: response.start,
    end: response.end,
    intervals: response.intervals,
  };
}

export function useMetricsStats() {
  const organization = useOrganization();
  const {selection} = usePageFilters();

  const queryInfo = useApiQuery<MetricsQueryApiResponse>(
    [
      `/organizations/${organization.slug}/metrics/query`,
      getMetricsStatsRequest(selection),
    ],
    {
      staleTime: Infinity,
    }
  );

  if (queryInfo.data) {
    return {...queryInfo, data: convertToStatsResponse(queryInfo.data)};
  }

  return queryInfo;
}
