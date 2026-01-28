import getApiUrl from 'sentry/utils/api/getApiUrl';
import {
  useApiQuery,
  type ApiQueryKey,
  type UseApiQueryOptions,
} from 'sentry/utils/queryClient';
import type {MetricRule} from 'sentry/views/alerts/rules/metric/types';

interface MetricRuleParams {
  orgSlug: string;
  ruleId: string;
  query?: {
    expand?: 'latestIncident';
  };
}

function makeMetricRuleQueryKey({orgSlug, ruleId, query}: MetricRuleParams): ApiQueryKey {
  return [
    getApiUrl('/organizations/$organizationIdOrSlug/alert-rules/$alertRuleId/', {
      path: {organizationIdOrSlug: orgSlug, alertRuleId: ruleId},
    }),
    {query},
  ];
}

export function useMetricRule(
  params: MetricRuleParams,
  options: Partial<UseApiQueryOptions<MetricRule>> = {}
) {
  return useApiQuery<MetricRule>(makeMetricRuleQueryKey(params), {
    staleTime: 0,
    ...options,
  });
}
