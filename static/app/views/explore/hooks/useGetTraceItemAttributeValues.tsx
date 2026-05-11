import {useCallback} from 'react';
import {
  queryOptions,
  useQueryClient,
  type QueryFunctionContext,
} from '@tanstack/react-query';

import {normalizeDateTimeParams} from 'sentry/components/pageFilters/parse';
import {usePageFilters} from 'sentry/components/pageFilters/usePageFilters';
import type {GetTagValuesParams} from 'sentry/components/searchQueryBuilder';
import type {PageFilters} from 'sentry/types/core';
import {defined} from 'sentry/utils';
import {apiOptions} from 'sentry/utils/api/apiOptions';
import type {ApiQueryKey} from 'sentry/utils/api/apiQueryKey';
import {FieldKind} from 'sentry/utils/fields';
import {useOrganization} from 'sentry/utils/useOrganization';
import {EXPLORE_FIVE_MIN_STALE_TIME} from 'sentry/views/explore/constants';
import type {UseTraceItemAttributeBaseProps} from 'sentry/views/explore/types';
import {findFreshEmptyPrefixSearchCacheMatch} from 'sentry/views/explore/utils/findFreshEmptyPrefixSearchCacheMatch';

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
    async ({tag, searchQuery}: GetTagValuesParams): Promise<string[]> => {
      if (tag.kind === FieldKind.FUNCTION || type === 'number' || type === 'boolean') {
        // We can't really auto suggest values for aggregate functions, numbers, or booleans
        return Promise.resolve([]);
      }

      const project =
        projectIds && projectIds.length > 0
          ? projectIds.map(String)
          : selection.projects.map(String);
      const datetimeParams = datetime
        ? normalizeDateTimeParams(datetime)
        : normalizeDateTimeParams(selection.datetime);

      const options = apiOptions.as<TraceItemAttributeValue[]>()(
        '/organizations/$organizationIdOrSlug/trace-items/attributes/$key/values/',
        {
          path: {organizationIdOrSlug: organization.slug, key: tag.key},
          staleTime: EXPLORE_FIVE_MIN_STALE_TIME,
          query: {
            itemType: traceItemType,
            attributeType: type,
            query: filterQuery || undefined,
            substringMatch: searchQuery || undefined,
            project,
            ...datetimeParams,
          },
        }
      );
      const originalQueryFn = options.queryFn;
      const optionsWithPrefixCacheShortcut =
        typeof originalQueryFn === 'function'
          ? queryOptions({
              ...options,
              queryFn: (ctx: QueryFunctionContext<ApiQueryKey>) => {
                return (
                  findFreshEmptyPrefixSearchCacheMatch({
                    client: ctx.client,
                    currentKey: ctx.queryKey,
                  }) ?? originalQueryFn(ctx)
                );
              },
            })
          : options;

      try {
        const {json} = await queryClient.fetchQuery(optionsWithPrefixCacheShortcut);
        return json
          .filter((item: TraceItemAttributeValue) => defined(item.value))
          .map((item: TraceItemAttributeValue) => item.value);
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
