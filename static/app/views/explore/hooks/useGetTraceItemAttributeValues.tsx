import {useCallback} from 'react';

import {normalizeDateTimeParams} from 'sentry/components/organizations/pageFilters/parse';
import type {GetTagValues} from 'sentry/components/searchQueryBuilder';
import type {PageFilters} from 'sentry/types/core';
import {defined} from 'sentry/utils';
import {FieldKind} from 'sentry/utils/fields';
import type {ApiQueryKey} from 'sentry/utils/queryClient';
import useApi from 'sentry/utils/useApi';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';
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
}

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
    itemType: traceItemType,
    attributeType: type,
  };

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
    `/organizations/${orgSlug}/trace-items/attributes/${attributeKey}/values/`,
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
}: UseGetTraceItemAttributeValuesProps) {
  const api = useApi();
  const organization = useOrganization();
  const {selection} = usePageFilters();

  // Create a function that can be used as getTagValues
  const getTraceItemAttributeValues = useCallback<GetTagValues>(
    async (tag, queryString) => {
      if (tag.kind === FieldKind.FUNCTION || type === 'number') {
        // We can't really auto suggest values for aggregate functions or numbers
        return Promise.resolve([]);
      }

      const queryKey = traceItemAttributeValuesQueryKey({
        orgSlug: organization.slug,
        attributeKey: tag.key,
        search: queryString,
        projectIds: projectIds ?? selection.projects,
        datetime: datetime ?? selection.datetime,
        traceItemType,
        type,
      });

      try {
        const result = await api.requestPromise(queryKey[0], {
          method: 'GET',
          query: {...queryKey[1]?.query},
        });
        return result
          .filter((item: TraceItemAttributeValue) => defined(item.value))
          .map((item: TraceItemAttributeValue) => item.value);
      } catch (e) {
        throw new Error(`Unable to fetch trace item attribute values: ${e}`);
      }
    },
    [
      api,
      type,
      organization.slug,
      projectIds,
      selection.projects,
      selection.datetime,
      datetime,
      traceItemType,
    ]
  );

  return getTraceItemAttributeValues;
}
