import type {MetricsExtractionRule} from 'sentry/types/metrics';
import {useApiQuery, type UseApiQueryOptions} from 'sentry/utils/queryClient';

interface MetricRulesAPIQueryParams {
  query?: string;
}

export const getMetricsExtractionRulesApiKey = (
  orgId: string | number,
  projectId?: string | number,
  query?: MetricRulesAPIQueryParams
) => {
  const endpoint = `/projects/${orgId}/${projectId}/metrics/extraction-rules/`;

  if (!query || Object.keys(query).length === 0) {
    // when no query is provided, return only endpoint path as a key
    return [endpoint] as const;
  }
  return [endpoint, {query: query}] as const;
};

export const getMetricsExtractionOrgApiKey = (orgSlug: string) =>
  [`/organizations/${orgSlug}/metrics/extraction-rules/`] as const;

interface GetParams {
  orgId: string | number;
  projectId?: string | number;
  query?: MetricRulesAPIQueryParams;
}

export function useMetricsExtractionRules(
  {orgId, projectId, query}: GetParams,
  options: Partial<UseApiQueryOptions<MetricsExtractionRule[]>> = {}
) {
  return useApiQuery<MetricsExtractionRule[]>(
    getMetricsExtractionRulesApiKey(orgId, projectId, query),
    {
      staleTime: 0,
      retry: false,
      ...options,
      enabled: !!projectId && options.enabled,
    }
  );
}
