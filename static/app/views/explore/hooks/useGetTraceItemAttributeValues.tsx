import {useCallback} from 'react';
import {
  queryOptions,
  useQueryClient,
  type QueryFunctionContext,
} from '@tanstack/react-query';

import {normalizeDateTimeParams} from 'sentry/components/pageFilters/parse';
import {usePageFilters} from 'sentry/components/pageFilters/usePageFilters';
import type {
  GetTagValuesParams,
  TagValueWithCount,
} from 'sentry/components/searchQueryBuilder';
import type {PageFilters, PageFilterDatetime} from 'sentry/types/core';
import {apiOptions} from 'sentry/utils/api/apiOptions';
import type {ApiQueryKey} from 'sentry/utils/api/apiQueryKey';
import {defined} from 'sentry/utils/defined';
import {FieldKind} from 'sentry/utils/fields';
import {useOrganization} from 'sentry/utils/useOrganization';
import {EXPLORE_FIVE_MIN_STALE_TIME} from 'sentry/views/explore/constants';
import type {UseTraceItemAttributeBaseProps} from 'sentry/views/explore/types';
import {findFreshEmptyPrefixSearchCacheMatch} from 'sentry/views/explore/utils/findFreshEmptyPrefixSearchCacheMatch';

export interface TraceItemAttributeValue {
  count: number | null;
  firstSeen: string | null;
  key: string;
  lastSeen: string | null;
  name: string;
  value: string | null;
}

interface UseGetTraceItemAttributeValuesProps extends UseTraceItemAttributeBaseProps {
  datetime?: PageFilterDatetime;
  projectIds?: PageFilters['projects'];
  query?: string;
}

interface TraceItemAttributeValuesQueryOptionsProps extends UseTraceItemAttributeBaseProps {
  datetime: PageFilterDatetime;
  organizationSlug: string;
  projectIds: PageFilters['projects'];
  searchQuery: string;
  tagKey: string;
  query?: string;
}

export function traceItemAttributeValuesQueryOptions({
  datetime,
  organizationSlug,
  projectIds,
  query,
  searchQuery,
  tagKey,
  traceItemType,
  type,
}: TraceItemAttributeValuesQueryOptionsProps) {
  const options = apiOptions.as<TraceItemAttributeValue[]>()(
    '/organizations/$organizationIdOrSlug/trace-items/attributes/$key/values/',
    {
      path: {organizationIdOrSlug: organizationSlug, key: tagKey},
      staleTime: EXPLORE_FIVE_MIN_STALE_TIME,
      query: {
        itemType: traceItemType,
        attributeType: type,
        query: query || undefined,
        substringMatch: searchQuery || undefined,
        project: projectIds.map(String),
        ...normalizeDateTimeParams(datetime),
      },
    }
  );
  const originalQueryFn = options.queryFn;

  return typeof originalQueryFn === 'function'
    ? queryOptions({
        ...options,
        queryFn: (ctx: QueryFunctionContext<ApiQueryKey>) =>
          findFreshEmptyPrefixSearchCacheMatch({
            client: ctx.client,
            currentKey: ctx.queryKey,
          }) ?? originalQueryFn(ctx),
      })
    : options;
}

/**
 * Hook to fetch trace item attribute values for the Explore interface.
 * This is designed to be used with the organization_trace_item_attributes endpoint.
 */
export function useGetTraceItemAttributeValues({
  traceItemType,
  projectIds,
  datetime,
  type,
  query: filterQuery,
}: UseGetTraceItemAttributeValuesProps) {
  const organization = useOrganization();
  const {selection} = usePageFilters();
  const queryClient = useQueryClient();

  return useCallback(
    async ({tag, searchQuery}: GetTagValuesParams): Promise<TagValueWithCount[]> => {
      if (tag.kind === FieldKind.FUNCTION || type === 'number' || type === 'boolean') {
        // We can't really auto suggest values for aggregate functions, numbers, or booleans
        return Promise.resolve([]);
      }

      const effectiveProjectIds =
        projectIds && projectIds.length > 0 ? projectIds : selection.projects;
      const effectiveDatetime = datetime ?? selection.datetime;
      const options = traceItemAttributeValuesQueryOptions({
        datetime: effectiveDatetime,
        organizationSlug: organization.slug,
        projectIds: effectiveProjectIds,
        query: filterQuery,
        searchQuery,
        tagKey: tag.key,
        traceItemType,
        type,
      });

      try {
        const {json} = await queryClient.fetchQuery(options);
        return json.flatMap((item: TraceItemAttributeValue) =>
          defined(item.value) ? [{value: item.value, count: item.count ?? undefined}] : []
        );
      } catch (e) {
        throw new Error(`Unable to fetch trace item attribute values: ${e}`);
      }
    },
    [
      datetime,
      filterQuery,
      organization.slug,
      projectIds,
      queryClient,
      selection.datetime,
      selection.projects,
      traceItemType,
      type,
    ]
  );
}
