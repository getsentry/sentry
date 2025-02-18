import {
  type ApiQueryKey,
  useApiQuery,
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

export function makeMetricRuleQueryKey({
  orgSlug,
  ruleId,
  query,
}: MetricRuleParams): ApiQueryKey {
  return [`/organizations/${orgSlug}/alert-rules/${ruleId}/`, {query}];
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
