import {usePageFilters} from 'sentry/components/pageFilters/usePageFilters';
import type {TagCollection} from 'sentry/types/group';
import {useMutation, useQueryClient} from 'sentry/utils/queryClient';
import {useOrganization} from 'sentry/utils/useOrganization';
import {TRACE_ITEM_ATTRIBUTE_STALE_TIME} from 'sentry/views/explore/constants';
import type {UseTraceItemAttributeBaseProps} from 'sentry/views/explore/types';
import {
  getTraceItemTagCollection,
  traceItemAttributeKeysOptions,
  type AttributeType,
} from 'sentry/views/explore/utils/traceItemAttributeKeysOptions';

interface UseGetTraceItemAttributeKeysProps extends UseTraceItemAttributeBaseProps {
  projectIds?: Array<string | number>;
  query?: string;
}

export function useGetTraceItemAttributeKeys({
  traceItemType,
  type,
  projectIds,
  query,
}: UseGetTraceItemAttributeKeysProps) {
  const {selection} = usePageFilters();
  const organization = useOrganization();
  const queryClient = useQueryClient();

  const {mutateAsync: getTraceItemAttributeKeys} = useMutation({
    mutationFn: async (queryString?: string): Promise<TagCollection> => {
      let result: AttributeType[];
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
