import {useMutation, useQueryClient} from '@tanstack/react-query';

import {normalizeDateTimeParams} from 'sentry/components/pageFilters/parse';
import {usePageFilters} from 'sentry/components/pageFilters/usePageFilters';
import type {GetTagValuesParams} from 'sentry/components/searchQueryBuilder';
import type {PageFilters} from 'sentry/types/core';
import {defined} from 'sentry/utils';
import {parseQueryKey} from 'sentry/utils/api/apiQueryKey';
import {getApiUrl} from 'sentry/utils/api/getApiUrl';
import {FieldKind} from 'sentry/utils/fields';
import {type ApiQueryKey} from 'sentry/utils/queryClient';
import {useApi} from 'sentry/utils/useApi';
import {useOrganization} from 'sentry/utils/useOrganization';
import {EXPLORE_FIVE_MIN_STALE_TIME} from 'sentry/views/explore/constants';
import type {
  TraceItemDataset,
  UseTraceItemAttributeBaseProps,
} from 'sentry/views/explore/types';

interface TraceItemAttributeValue {
  first_seen: null;
  key: string;
  last_seen: null;
  times_seen: null;
  value: string;
}

interface UseGetTraceItemAttributeValuesProps extends UseTraceItemAttributeBaseProps {
  datetime?: PageFilters['datetime'];
  projectIds?: PageFilters['projects'];
  query?: string;
}

function traceItemAttributeValuesQueryKey({
  orgSlug,
  attributeKey,
  search,
  projectIds,
  datetime,
  traceItemType,
  type = 'string',
  query: filterQuery,
}: {
  attributeKey: string;
  orgSlug: string;
  traceItemType: TraceItemDataset;
  datetime?: PageFilters['datetime'];
  projectIds?: number[];
  query?: string;
  search?: string;
  type?: 'string' | 'number' | 'boolean';
}): ApiQueryKey {
  const query: Record<string, string | string[] | number[]> = {
    itemType: traceItemType,
    attributeType: type,
  };

  if (filterQuery) {
    query.query = filterQuery;
  }

  if (search) {
    query.substringMatch = search;
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
    getApiUrl(
      '/organizations/$organizationIdOrSlug/trace-items/attributes/$key/values/',
      {
        path: {organizationIdOrSlug: orgSlug, key: attributeKey},
      }
    ),
    {query},
  ];
}

/**
 * Hook to fetch trace item attribute values for the Explore interface.
 * This is designed to be used with the organization_trace_item_attributes endpoint.
 */
export function useGetTraceItemAttributeValues({
  traceItemType,
  projectIds,
  datetime,
  type = 'string',
  query: filterQuery,
}: UseGetTraceItemAttributeValuesProps) {
  const api = useApi();
  const organization = useOrganization();
  const {selection} = usePageFilters();
  const queryClient = useQueryClient();

  const {mutateAsync: getTraceItemAttributeValues} = useMutation({
    mutationFn: async ({tag, searchQuery}: GetTagValuesParams): Promise<string[]> => {
      if (tag.kind === FieldKind.FUNCTION || type === 'number' || type === 'boolean') {
        // We can't really auto suggest values for aggregate functions, numbers, or booleans
        return Promise.resolve([]);
      }

      const queryKey = traceItemAttributeValuesQueryKey({
        orgSlug: organization.slug,
        attributeKey: tag.key,
        search: searchQuery,
        projectIds: projectIds ?? selection.projects,
        datetime: datetime ?? selection.datetime,
        traceItemType,
        type,
        query: filterQuery,
      });

      try {
        const {url, options} = parseQueryKey(queryKey);
        const result = await queryClient.fetchQuery({
          queryKey,
          queryFn: () =>
            api.requestPromise(url, {
              method: 'GET',
              query: {...options?.query},
            }),
          staleTime: EXPLORE_FIVE_MIN_STALE_TIME,
        });
        return result
          .filter((item: TraceItemAttributeValue) => defined(item.value))
          .map((item: TraceItemAttributeValue) => item.value);
      } catch (e) {
        throw new Error(`Unable to fetch trace item attribute values: ${e}`);
      }
    },
  });

  return getTraceItemAttributeValues;
}
