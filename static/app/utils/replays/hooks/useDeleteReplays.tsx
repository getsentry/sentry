import {useCallback} from 'react';

import {hasEveryAccess} from 'sentry/components/acl/access';
import {parseStatsPeriod} from 'sentry/components/timeRangeSelector/utils';
import {
  fetchMutation,
  type QueryKeyEndpointOptions,
  useMutation,
} from 'sentry/utils/queryClient';
import useOrganization from 'sentry/utils/useOrganization';
import useProjectFromSlug from 'sentry/utils/useProjectFromSlug';

interface Props {
  projectSlug: string;
}

export type ReplayBulkDeletePayload = {
  environments: string[];
  query: string;
  rangeEnd: string;
  rangeStart: string;
};

type Vars = [ReplayBulkDeletePayload];

export default function useDeleteReplays({projectSlug}: Props) {
  const organization = useOrganization();
  const project = useProjectFromSlug({organization, projectSlug});
  const hasWriteAccess = hasEveryAccess(['project:write'], {organization, project});
  const hasAdminAccess = hasEveryAccess(['project:admin'], {organization, project});

  const canDelete = Boolean(projectSlug) && (hasWriteAccess || hasAdminAccess);

  const {mutate} = useMutation({
    mutationFn: ([data]: Vars) => {
      if (!projectSlug) {
        throw new Error('Project ID or slug is required');
      }
      if (!canDelete) {
        throw new Error('User does not have permission to delete replays');
      }

      const options = {};
      const payload = {data};
      return fetchMutation([
        'POST',
        `/projects/${organization.slug}/${projectSlug}/replays/jobs/delete/`,
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
    canDelete,
    queryOptionsToPayload,
  };
}
