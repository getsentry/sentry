import type {MetricType} from 'sentry/types/metrics';
import type {FormattingSupportedMetricUnit} from 'sentry/utils/metrics/formatters';
import {
  type ApiQueryKey,
  getApiQueryData,
  type QueryClient,
  setApiQueryData,
  useApiQuery,
  useMutation,
  useQueryClient,
} from 'sentry/utils/queryClient';
import type RequestError from 'sentry/utils/requestError/requestError';
import useApi from 'sentry/utils/useApi';

const getMetricsExtractionRulesEndpoint = (orgSlug: string, projectSlug: string) =>
  [`/projects/${orgSlug}/${projectSlug}/metrics/extraction-rules/`] as const;

export interface MetricsExtractionRule {
  conditions: string[];
  spanAttribute: string;
  tags: string[];
  type: MetricType;
  unit: FormattingSupportedMetricUnit;
}

export function useMetricsExtractionRules(orgSlug: string, projectSlug: string) {
  return useApiQuery<MetricsExtractionRule[]>(
    getMetricsExtractionRulesEndpoint(orgSlug, projectSlug),
    {
      staleTime: 0,
      retry: false,
    }
  );
}

// Rules are identified by the combination of span_attribute, type and unit
function getRuleIdentifier(rule: MetricsExtractionRule) {
  return rule.spanAttribute + rule.type + rule.unit;
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

export function useDeleteMetricsExtractionRules(orgSlug: string, projectSlug: string) {
  const api = useApi();
  const queryClient = useQueryClient();
  const queryKey = getMetricsExtractionRulesEndpoint(orgSlug, projectSlug);

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
      },
    }
  );
}

export function useCreateMetricsExtractionRules(orgSlug: string, projectSlug: string) {
  const api = useApi();
  const queryClient = useQueryClient();
  const queryKey = getMetricsExtractionRulesEndpoint(orgSlug, projectSlug);

  return useMutation<
    MetricsExtractionRule[],
    RequestError,
    {metricsExtractionRules: MetricsExtractionRule[]},
    {previous?: MetricsExtractionRule[]}
  >(
    data => {
      return api.requestPromise(queryKey[0], {
        method: 'POST',
        data,
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
      },
    }
  );
}

export function useUpdateMetricsExtractionRules(orgSlug: string, projectSlug: string) {
  const api = useApi();
  const queryClient = useQueryClient();
  const queryKey = getMetricsExtractionRulesEndpoint(orgSlug, projectSlug);

  return useMutation<
    MetricsExtractionRule[],
    RequestError,
    {metricsExtractionRules: MetricsExtractionRule[]},
    {previous?: MetricsExtractionRule[]}
  >(
    data => {
      return api.requestPromise(queryKey[0], {
        method: 'PUT',
        data,
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
      },
    }
  );
}
