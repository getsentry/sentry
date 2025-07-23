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
  environments: string | string[] | undefined;
  query: string;
  rangeEnd: string | undefined;
  rangeStart: string | undefined;
};

type Vars = [ReplayBulkDeletePayload];

export default function useDeleteReplays({projectSlug}: Props) {
  const organization = useOrganization();
  const project = useProjectFromSlug({organization, projectSlug});
  const hasWriteAccess = hasEveryAccess(['project:write'], {organization, project});
  const hasAdminAccess = hasEveryAccess(['project:admin'], {organization, project});

  const hasAccess = Boolean(projectSlug) && (hasWriteAccess || hasAdminAccess);

  const {mutate} = useMutation({
    mutationFn: ([data]: Vars) => {
      if (!projectSlug) {
        throw new Error('Project ID or slug is required');
      }
      if (!hasAccess) {
        throw new Error('User does not have permission to delete replays');
      }

      const options = {};
      const payload = {data};
      return fetchMutation({
        method: 'POST',
        url: `/projects/${organization.slug}/${projectSlug}/replays/jobs/delete/`,
        options,
        data: payload,
      });
    },
  });

  const queryOptionsToPayload = useCallback(
    (
      selectedIds: 'all' | string[],
      queryOptions: QueryKeyEndpointOptions<unknown, Record<string, string>, unknown>
    ): ReplayBulkDeletePayload => {
      const environments = queryOptions?.query?.environment ?? [];
      const {start, end} = queryOptions?.query?.statsPeriod
        ? parseStatsPeriod(queryOptions?.query?.statsPeriod)
        : (queryOptions?.query ?? {start: undefined, end: undefined});

      return {
        environments: environments.length === 0 ? project?.environments : environments,
        query:
          selectedIds === 'all'
            ? (queryOptions?.query?.query ?? '')
            : `id:[${selectedIds.join(',')}]`,
        rangeStart: start ? new Date(start).toISOString() : start,
        rangeEnd: end ? new Date(end).toISOString() : end,
      };
    },
    [project?.environments]
  );

  return {
    bulkDelete: mutate,
    hasAccess,
    queryOptionsToPayload,
  };
}
