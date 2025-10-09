import {useMemo} from 'react';

import {normalizeDateTimeParams} from 'sentry/components/organizations/pageFilters/parse';
import type {Tag, TagCollection} from 'sentry/types/group';
import {useQuery} from 'sentry/utils/queryClient';
import useApi from 'sentry/utils/useApi';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';
import usePrevious from 'sentry/utils/usePrevious';
import {getTraceItemTagCollection} from 'sentry/views/explore/hooks/useGetTraceItemAttributeKeys';
import {TraceItemDataset} from 'sentry/views/explore/types';

interface UseMetricAttributeKeysProps {
  /**
   * The metric name to filter attributes by
   */
  metricName: string;
  /**
   * Whether to enable the query
   */
  enabled?: boolean;
  /**
   * The type of attributes to fetch (defaults to 'string' for group by)
   */
  type?: 'string' | 'number';
}

/**
 * Hook to fetch metric attribute keys from the trace-items API endpoint.
 * This hook is specifically designed for metrics and uses the metric name
 * as a query filter to return only relevant attributes.
 */
export function useMetricAttributeKeys({
  metricName,
  enabled = true,
  type = 'string',
}: UseMetricAttributeKeysProps) {
  const api = useApi();
  const organization = useOrganization();
  const {selection} = usePageFilters();

  // Build the query filter using the metric name
  const queryFilter = useMemo(() => {
    if (!metricName) {
      return undefined;
    }
    // Filter by metric name to get attributes specific to this metric
    return `metric.name:"${metricName}"`;
  }, [metricName]);

  const queryOptions = useMemo(() => {
    const normalizedDateTime = normalizeDateTimeParams(selection.datetime);

    return {
      itemType: TraceItemDataset.TRACEMETRICS,
      attributeType: type,
      project: selection.projects.map(String),
      query: queryFilter,
      ...normalizedDateTime,
    };
  }, [selection, type, queryFilter]);

  const queryKey = useMemo(
    () => ['metric-attribute-keys', organization.slug, queryOptions],
    [organization.slug, queryOptions]
  );

  const fetchAttributeKeys = async (): Promise<TagCollection> => {
    try {
      const result: Tag[] = await api.requestPromise(
        `/organizations/${organization.slug}/trace-items/attributes/`,
        {
          method: 'GET',
          query: queryOptions,
        }
      );

      return getTraceItemTagCollection(result, type);
    } catch (error) {
      throw new Error(`Unable to fetch metric attribute keys: ${error}`);
    }
  };

  const {data, isFetching, error} = useQuery<TagCollection>({
    queryKey,
    queryFn: fetchAttributeKeys,
    enabled: enabled && !!metricName,
    staleTime: 60000, // Cache for 1 minute
  });

  const previous = usePrevious(data, isFetching);

  return {
    attributes: isFetching ? previous : data,
    error,
    isLoading: isFetching,
  };
}
