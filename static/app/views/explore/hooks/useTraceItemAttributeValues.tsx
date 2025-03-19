import {useCallback} from 'react';

import {normalizeDateTimeParams} from 'sentry/components/organizations/pageFilters/parse';
import type {PageFilters} from 'sentry/types/core';
import type {Tag} from 'sentry/types/group';
import {defined} from 'sentry/utils';
import {
  type ApiQueryKey,
  useApiQuery,
  type UseApiQueryOptions,
} from 'sentry/utils/queryClient';
import useApi from 'sentry/utils/useApi';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';
import type {UseTraceItemAttributeBaseProps} from 'sentry/views/explore/hooks/useTraceItemAttributeKeys';
import type {TraceItemDataset} from 'sentry/views/explore/types';
import {
  getRetryDelay,
  shouldRetryHandler,
} from 'sentry/views/insights/common/utils/retryHandlers';

export interface TraceItemAttributeValue {
  first_seen: null;
  key: string;
  last_seen: null;
  times_seen: null;
  value: string;
}

interface UseTraceItemAttributeValuesProps extends UseTraceItemAttributeBaseProps {
  /**
   * The attribute key for which to fetch values
   */
  attributeKey: string;
  /**
   * Optional datetime filter
   */
  datetime?: PageFilters['datetime'];
  /**
   * Whether the query should be enabled
   */
  enabled?: boolean;
  /**
   * Optional project IDs to filter by
   */
  projectIds?: PageFilters['projects'];
  /**
   * Optional search string to filter values
   */
  search?: string;
}

type OrganizationTraceItemAttributeValuesResponse = TraceItemAttributeValue[];

function traceItemAttributeValuesQueryKey({
  orgSlug,
  attributeKey,
  search,
  projectIds,
  datetime,
  traceItemType,
  type = 'string',
}: {
  attributeKey: string;
  orgSlug: string;
  traceItemType: TraceItemDataset;
  datetime?: PageFilters['datetime'];
  projectIds?: number[];
  search?: string;
  type?: 'string' | 'number';
}): ApiQueryKey {
  const query: Record<string, string | string[] | number[]> = {
    item_type: traceItemType,
    attribute_type: type,
  };

  if (search) {
    query.query = search;
  }

  if (projectIds?.length) {
    query.project = projectIds.map(String);
  }

  if (datetime) {
    Object.entries(normalizeDateTimeParams(datetime)).forEach(([key, value]) => {
      if (value !== undefined) {
        query[key] = value as string | string[];
      }
    });
  }

  return [
    `/organizations/${orgSlug}/trace-items/attributes/${attributeKey}/values/`,
    {query},
  ];
}

/**
 * Hook to fetch trace item attribute values for the Explore interface.
 * This is designed to be used with the organization_trace_item_attributes endpoint.
 */
export function useTraceItemAttributeValues({
  traceItemType,
  attributeKey,
  search = '',
  projectIds,
  datetime,
  type = 'string',
  enabled = true,
}: UseTraceItemAttributeValuesProps) {
  const api = useApi();
  const organization = useOrganization();
  const {selection} = usePageFilters();

  const queryOptions: UseApiQueryOptions<OrganizationTraceItemAttributeValuesResponse> = {
    staleTime: 60000, // 1 minute
    retry: shouldRetryHandler,
    retryDelay: getRetryDelay,
    enabled: enabled && !!attributeKey,
  };

  const queryKey = traceItemAttributeValuesQueryKey({
    orgSlug: organization.slug,
    attributeKey,
    search,
    projectIds: projectIds ?? selection.projects,
    datetime: datetime ?? selection.datetime,
    traceItemType,
    type,
  });

  const queryResult = useApiQuery<OrganizationTraceItemAttributeValuesResponse>(
    queryKey,
    queryOptions
  );

  // Reformat the data to match the expected format for the SearchQueryBuilder
  const formattedData = queryResult.data
    ?.filter(item => defined(item.value))
    .map(item => item.value);

  // Create a function that can be used as getTagValues
  const getTraceItemAttributeValues = useCallback(
    async (tag: Tag, queryString: string): Promise<string[]> => {
      if (tag.kind === FieldKind.FUNCTION || type === 'number') {
        // We can't really auto suggest values for aggregate functions or numbers
        return Promise.resolve([]);
      }

      try {
        const result = await api.requestPromise(queryKey[0], {
          method: 'GET',
          query: {...queryKey[1]?.query, query: queryString},
        });

        return result
          .filter((item: TraceItemAttributeValue) => defined(item.value))
          .map((item: TraceItemAttributeValue) => item.value);
      } catch (e) {
        throw new Error(`Unable to fetch trace item attribute values: ${e}`);
      }
    },
    [api, type, queryKey]
  );

  return {
    ...queryResult,
    data: formattedData,
    getTraceItemAttributeValues,
  };
}
