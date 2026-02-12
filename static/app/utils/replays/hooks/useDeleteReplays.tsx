import {useCallback} from 'react';

import {hasEveryAccess} from 'sentry/components/acl/access';
import {getUtcValue, normalizeDateTimeParams} from 'sentry/components/pageFilters/parse';
import {parseStatsPeriod} from 'sentry/components/timeRangeSelector/utils';
import {getDateFromTimestamp, getDateWithTimezoneInUtc} from 'sentry/utils/dates';
import {
  fetchMutation,
  useMutation,
  type QueryKeyEndpointOptions,
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

      const query = queryOptions?.query ?? {};
      const normalizedQuery = normalizeDateTimeParams(query);

      // normalizeDateTimeParams will prefer statsPeriod, so if we find that
      // then we still need to parse out start & end
      const {start, end} = normalizedQuery.statsPeriod
        ? parseStatsPeriod(normalizedQuery.statsPeriod)
        : normalizedQuery;

      return {
        environments: environments.length === 0 ? project?.environments : environments,
        query:
          selectedIds === 'all'
            ? (queryOptions?.query?.query ?? '')
            : `id:[${selectedIds.join(',')}]`,
        rangeStart: getDateWithTimezoneInUtc(
          getDateFromTimestamp(start) ?? new Date(),
          getUtcValue(normalizedQuery.utc) === 'true'
        ).toISOString(),
        rangeEnd: getDateWithTimezoneInUtc(
          getDateFromTimestamp(end) ?? new Date(),
          getUtcValue(normalizedQuery.utc) === 'true'
        ).toISOString(),
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
