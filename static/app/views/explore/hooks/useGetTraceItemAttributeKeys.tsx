import {useMutation, useQueryClient} from '@tanstack/react-query';

import {usePageFilters} from 'sentry/components/pageFilters/usePageFilters';
import type {TagCollection} from 'sentry/types/group';
import {useOrganization} from 'sentry/utils/useOrganization';
import {TRACE_ITEM_ATTRIBUTE_STALE_TIME} from 'sentry/views/explore/constants';
import type {UseTraceItemAttributeBaseProps} from 'sentry/views/explore/types';
import {
  getTraceItemTagCollection,
  traceItemAttributeKeysOptions,
} from 'sentry/views/explore/utils/traceItemAttributeKeysOptions';

interface UseGetTraceItemAttributeKeysProps extends Omit<
  UseTraceItemAttributeBaseProps,
  'type'
> {
  projectIds?: Array<string | number>;
  query?: string;
}

export function useGetTraceItemAttributeKeys({
  traceItemType,
  projectIds,
  query,
}: UseGetTraceItemAttributeKeysProps) {
  const {selection} = usePageFilters();
  const organization = useOrganization();
  const queryClient = useQueryClient();

  const {mutateAsync: getTraceItemAttributeKeys} = useMutation({
    mutationFn: async (
      queryString?: string
    ): Promise<{
      booleanAttributes: TagCollection;
      numberAttributes: TagCollection;
      stringAttributes: TagCollection;
    }> => {
      try {
        const {json} = await queryClient.fetchQuery({
          ...traceItemAttributeKeysOptions({
            organization,
            selection,
            traceItemType,
            projectIds: projectIds ?? selection.projects,
            search: queryString,
            query,
            staleTime: TRACE_ITEM_ATTRIBUTE_STALE_TIME,
          }),
        });
        return getTraceItemTagCollection(json);
      } catch (e) {
        throw new Error(`Unable to fetch trace item attribute keys: ${e}`);
      }
    },
  });

  return getTraceItemAttributeKeys;
}
