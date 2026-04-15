import {normalizeDateTimeParams} from 'sentry/components/pageFilters/parse';
import {usePageFilters} from 'sentry/components/pageFilters/usePageFilters';
import type {PageFilters} from 'sentry/types/core';
import type {Tag, TagCollection} from 'sentry/types/group';
import {useMutation, useQueryClient} from 'sentry/utils/queryClient';
import {useOrganization} from 'sentry/utils/useOrganization';
import {TRACE_ITEM_ATTRIBUTE_STALE_TIME} from 'sentry/views/explore/constants';
import type {
  TraceItemDataset,
  UseTraceItemAttributeBaseProps,
} from 'sentry/views/explore/types';
import {
  getTraceItemTagCollection,
  traceItemAttributeKeysOptions,
} from 'sentry/views/explore/utils/traceItemAttributeKeysOptions';

interface UseGetTraceItemAttributeKeysProps extends UseTraceItemAttributeBaseProps {
  projectIds?: Array<string | number>;
  query?: string;
}

type TraceItemAttributeKeyOptions = Pick<
  ReturnType<typeof normalizeDateTimeParams>,
  'end' | 'start' | 'statsPeriod' | 'utc'
> & {
  attributeType: 'string' | 'number' | 'boolean';
  itemType: TraceItemDataset;
  project?: string[];
  query?: string;
  substringMatch?: string;
};

const QUERY_KEY = 'use-get-trace-item-attribute-keys';
function normalizeSubstringMatch(search?: string) {
  return search || undefined;
}

export function makeTraceItemAttributeKeysQueryOptions({
  traceItemType,
  type,
  datetime,
  projectIds,
  search,
  query,
}: {
  datetime: PageFilters['datetime'];
  traceItemType: TraceItemDataset;
  type: 'string' | 'number' | 'boolean';
  projectIds?: Array<string | number>;
  query?: string;
  search?: string;
}): TraceItemAttributeKeyOptions {
  const substringMatch = normalizeSubstringMatch(search);
  const options: TraceItemAttributeKeyOptions = {
    itemType: traceItemType,
    attributeType: type,
    project: projectIds?.map(String),
    query,
    ...normalizeDateTimeParams(datetime),
    ...(substringMatch === undefined ? {} : {substringMatch}),
  };

  // environment left out intentionally as it's not supported

  return options;
}
export function useGetTraceItemAttributeKeys({
  traceItemType,
  projectIds,
  type,
  query,
}: UseGetTraceItemAttributeKeysProps) {
  const {selection} = usePageFilters();
  const organization = useOrganization();
  const queryClient = useQueryClient();

  const {mutateAsync: getTraceItemAttributeKeys} = useMutation({
    mutationFn: async (queryString?: string): Promise<TagCollection> => {
      let result: Tag[];
      try {
        const {json} = await queryClient.fetchQuery({
          ...traceItemAttributeKeysOptions({
            organization,
            selection,
            traceItemType,
            type,
            projectIds: projectIds ?? selection.projects,
            search: queryString,
            query,
            staleTime: TRACE_ITEM_ATTRIBUTE_STALE_TIME,
          }),
        });
        result = json;
      } catch (e) {
        throw new Error(`Unable to fetch trace item attribute keys: ${e}`);
      }

      return getTraceItemTagCollection(result, type);
    },
  });

  return getTraceItemAttributeKeys;
}
