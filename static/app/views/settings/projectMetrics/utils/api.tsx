import type {MetricType} from 'sentry/types/metrics';
import type {FormattingSupportedMetricUnit} from 'sentry/utils/metrics/formatters';
import {
  getApiQueryData,
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
      onMutate: data => {
        queryClient.cancelQueries(queryKey);

        const previous = getApiQueryData<MetricsExtractionRule[]>(queryClient, queryKey);

        const deletedRules = data.metricsExtractionRules;
        const deletedKeys = new Set(deletedRules.map(getRuleIdentifier));

        setApiQueryData<MetricsExtractionRule[]>(queryClient, queryKey, oldRules => {
          return oldRules?.filter(rule => !deletedKeys.has(getRuleIdentifier(rule)));
        });

        return {previous};
      },
      onError: (_error, _variables, context) => {
        if (context?.previous) {
          setApiQueryData<MetricsExtractionRule[]>(
            queryClient,
            queryKey,
            context.previous
          );
        }
      },
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
      // TODO: Implement optimistic updates
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
      onMutate: data => {
        queryClient.cancelQueries(queryKey);

        const previous = getApiQueryData<MetricsExtractionRule[]>(queryClient, queryKey);

        const updatedRules = data.metricsExtractionRules;
        const updatedRulesMap = new Map(
          updatedRules.map(rule => [getRuleIdentifier(rule), rule])
        );

        setApiQueryData<MetricsExtractionRule[]>(queryClient, queryKey, oldRules => {
          return oldRules?.map(rule => {
            const updatedRule = updatedRulesMap.get(getRuleIdentifier(rule));
            return updatedRule ?? rule;
          });
        });

        return {previous};
      },
      onError: (_error, _variables, context) => {
        if (context?.previous) {
          setApiQueryData<MetricsExtractionRule[]>(
            queryClient,
            queryKey,
            context.previous
          );
        }
      },
      onSettled: () => {
        queryClient.invalidateQueries(queryKey);
      },
    }
  );
}
