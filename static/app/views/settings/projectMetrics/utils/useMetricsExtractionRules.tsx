import type {MetricsExtractionRule} from 'sentry/types/metrics';
import {
  type ApiQueryKey,
  getApiQueryData,
  type QueryClient,
  setApiQueryData,
  useApiQuery,
  type UseApiQueryOptions,
  useMutation,
  useQueryClient,
} from 'sentry/utils/queryClient';
import type RequestError from 'sentry/utils/requestError/requestError';
import useApi from 'sentry/utils/useApi';

/**
 * Remove temporary ids from conditions before sending to the server
 */
function filterTempIds(rules: MetricsExtractionRule[]) {
  return rules.map(rule => ({
    ...rule,
    conditions: rule.conditions.map(condition => ({
      ...condition,
      id: condition.id < 0 ? undefined : condition.id,
    })),
  }));
}
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

// Rules are identified by the combination of span_attribute, type and unit
function getRuleIdentifier(rule: MetricsExtractionRule) {
  return rule.spanAttribute + rule.unit;
}

function createOptimisticUpdate(
  queryClient: QueryClient,
  queryKey: ApiQueryKey,
  updater: (
    variables: {metricsExtractionRules: MetricsExtractionRule[]},
    old: MetricsExtractionRule[] | undefined
  ) => MetricsExtractionRule[] | undefined
) {
  return function (variables: {metricsExtractionRules: MetricsExtractionRule[]}) {
    queryClient.cancelQueries(queryKey);
    const previous = getApiQueryData<MetricsExtractionRule[]>(queryClient, queryKey);

    setApiQueryData<MetricsExtractionRule[] | undefined>(
      queryClient,
      queryKey,
      oldRules => {
        return updater(variables, oldRules);
      }
    );

    return {previous};
  };
}

function createRollback(queryClient: QueryClient, queryKey: ApiQueryKey) {
  return function (
    _error: RequestError,
    _variables: {metricsExtractionRules: MetricsExtractionRule[]},
    context?: {previous?: MetricsExtractionRule[]}
  ) {
    if (context?.previous) {
      setApiQueryData<MetricsExtractionRule[]>(queryClient, queryKey, context.previous);
    }
  };
}

export function useDeleteMetricsExtractionRules(
  orgSlug: string,
  projectId: string | number
) {
  const api = useApi();
  const queryClient = useQueryClient();
  const queryKey = getMetricsExtractionRulesApiKey(orgSlug, projectId);

  return useMutation<
    MetricsExtractionRule[],
    RequestError,
    {metricsExtractionRules: MetricsExtractionRule[]},
    {previous?: MetricsExtractionRule[]}
  >(
    data => {
      return api.requestPromise(queryKey[0], {
        method: 'DELETE',
        data,
      });
    },
    {
      onMutate: createOptimisticUpdate(queryClient, queryKey, (variables, old) => {
        const deletedRules = variables.metricsExtractionRules;
        const deletedKeys = new Set(deletedRules.map(getRuleIdentifier));
        return old?.filter(rule => !deletedKeys.has(getRuleIdentifier(rule)));
      }),
      onError: createRollback(queryClient, queryKey),
      onSettled: () => {
        queryClient.invalidateQueries(queryKey);
        queryClient.invalidateQueries(getMetricsExtractionOrgApiKey(orgSlug));
      },
    }
  );
}

export function useCreateMetricsExtractionRules(
  orgSlug: string,
  projectId: string | number
) {
  const api = useApi();
  const queryClient = useQueryClient();
  const queryKey = getMetricsExtractionRulesApiKey(orgSlug, projectId);

  return useMutation<
    MetricsExtractionRule[],
    RequestError,
    {metricsExtractionRules: MetricsExtractionRule[]},
    {previous?: MetricsExtractionRule[]}
  >(
    data => {
      return api.requestPromise(queryKey[0], {
        method: 'POST',
        data: {
          metricsExtractionRules: filterTempIds(data.metricsExtractionRules),
        },
      });
    },
    {
      onMutate: createOptimisticUpdate(queryClient, queryKey, (variables, old) => {
        const newRules = variables.metricsExtractionRules;
        const existingKeys = new Set((old ?? []).map(getRuleIdentifier));
        const copy = old ? [...old] : [];
        newRules.forEach(rule => {
          if (!existingKeys.has(getRuleIdentifier(rule))) {
            copy.push(rule);
          }
        });
        return copy;
      }),
      onError: createRollback(queryClient, queryKey),
      onSettled: () => {
        queryClient.invalidateQueries(queryKey);
        queryClient.invalidateQueries(getMetricsExtractionOrgApiKey(orgSlug));
      },
    }
  );
}

export function useUpdateMetricsExtractionRules(
  orgSlug: string,
  projectId: string | number
) {
  const api = useApi();
  const queryClient = useQueryClient();
  const queryKey = getMetricsExtractionRulesApiKey(orgSlug, projectId);

  return useMutation<
    MetricsExtractionRule[],
    RequestError,
    {metricsExtractionRules: MetricsExtractionRule[]},
    {previous?: MetricsExtractionRule[]}
  >(
    data => {
      return api.requestPromise(queryKey[0], {
        method: 'PUT',
        data: {
          metricsExtractionRules: filterTempIds(data.metricsExtractionRules),
        },
      });
    },
    {
      onMutate: createOptimisticUpdate(queryClient, queryKey, (variables, old) => {
        const updatedRules = variables.metricsExtractionRules;
        const updatedRulesMap = new Map(
          updatedRules.map(rule => [getRuleIdentifier(rule), rule])
        );
        return old?.map(rule => {
          const updatedRule = updatedRulesMap.get(getRuleIdentifier(rule));
          return updatedRule ?? rule;
        });
      }),
      onError: createRollback(queryClient, queryKey),
      onSettled: () => {
        queryClient.invalidateQueries(queryKey);
        queryClient.invalidateQueries(getMetricsExtractionOrgApiKey(orgSlug));
      },
    }
  );
}
