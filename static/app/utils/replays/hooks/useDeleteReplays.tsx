import {useCallback} from 'react';

import {parseStatsPeriod} from 'sentry/components/timeRangeSelector/utils';
import {
  fetchMutation,
  type QueryKeyEndpointOptions,
  useMutation,
} from 'sentry/utils/queryClient';
import useOrganization from 'sentry/utils/useOrganization';

interface Props {
  projectIdOrSlug: string;
  queryOptions: QueryKeyEndpointOptions | undefined;
}

export type ReplayBulkDeletePayload = {
  environments: string[];
  query: string;
  rangeEnd: string;
  rangeStart: string;
};

type Vars = [ReplayBulkDeletePayload];

export default function useDeleteReplays({projectIdOrSlug}: Props) {
  const organization = useOrganization();

  const {mutate} = useMutation({
    mutationFn: ([data]: Vars) => {
      if (!projectIdOrSlug) {
        throw new Error('Project ID or slug is required');
      }

      const options = {};
      const payload = {data};
      return fetchMutation([
        'POST',
        `/projects/${organization.slug}/${projectIdOrSlug}/replays/jobs/delete/`,
        options,
        payload,
      ]);
    },
  });

  const queryOptionsToPayload = useCallback(
    (selectedIds: 'all' | string[], queryOptions: QueryKeyEndpointOptions) => {
      const {start, end} = queryOptions?.query?.statsPeriod
        ? parseStatsPeriod(queryOptions?.query?.statsPeriod)
        : (queryOptions?.query ?? {start: undefined, end: undefined});

      return {
        environments: queryOptions?.query?.environment,
        query:
          selectedIds === 'all'
            ? queryOptions?.query?.query
            : `id:${selectedIds.join(',')}`,
        rangeEnd: end,
        rangeStart: start,
      };
    },
    []
  );

  return {
    bulkDelete: mutate,
    canDelete: Boolean(projectIdOrSlug),
    queryOptionsToPayload,
  };
}
