import {useCallback} from 'react';
import {useMutation} from '@tanstack/react-query';

import {hasEveryAccess} from 'sentry/components/acl/access';
import {getUtcValue, normalizeDateTimeParams} from 'sentry/components/pageFilters/parse';
import {parseStatsPeriod} from 'sentry/components/timeRangeSelector/utils';
import type {QueryKeyEndpointOptions} from 'sentry/utils/api/apiQueryKey';
import {getApiUrl} from 'sentry/utils/api/getApiUrl';
import {getDateFromTimestamp, getDateWithTimezoneInUtc} from 'sentry/utils/dates';
import {fetchMutation} from 'sentry/utils/queryClient';
import {RequestError} from 'sentry/utils/requestError/requestError';
import {useOrganization} from 'sentry/utils/useOrganization';
import {useProjectFromSlug} from 'sentry/utils/useProjectFromSlug';

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

export function useDeleteReplays({projectSlug}: Props) {
  const organization = useOrganization();
  const project = useProjectFromSlug({organization, projectSlug});
  const hasWriteAccess = hasEveryAccess(['project:write'], {organization, project});
  const hasAdminAccess = hasEveryAccess(['project:admin'], {organization, project});
  const hasOrgAdminAccess = hasEveryAccess(['org:admin'], {organization});

  const hasAccess =
    Boolean(projectSlug) && (hasWriteAccess || hasAdminAccess || hasOrgAdminAccess);

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
        url: getApiUrl(
          '/projects/$organizationIdOrSlug/$projectIdOrSlug/replays/jobs/delete/',
          {path: {organizationIdOrSlug: organization.slug, projectIdOrSlug: projectSlug}}
        ),
        options,
        data: payload,
      });
    },
  });

  const queryOptionsToPayload = useCallback(
    (
      selectedIds: 'all' | string[],
      queryOptions: QueryKeyEndpointOptions
    ): ReplayBulkDeletePayload => {
      const environments = (queryOptions?.query?.environment as string | undefined) ?? [];

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
            ? ((queryOptions?.query?.query as string | undefined) ?? '')
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

function collectErrorStrings(value: unknown, field?: string): string[] {
  if (typeof value === 'string') {
    return [field ? `${field} — ${value}` : value];
  }
  if (Array.isArray(value)) {
    return value.flatMap(item => collectErrorStrings(item, field));
  }
  if (value && typeof value === 'object') {
    return Object.entries(value).flatMap(([key, item]) =>
      collectErrorStrings(item, key === 'non_field_errors' ? field : key)
    );
  }
  return [];
}

export function getBulkDeleteErrorReason(error: unknown): string | undefined {
  if (!(error instanceof RequestError)) {
    return undefined;
  }

  const {detail, data} = error.responseJSON ?? {};

  if (typeof detail === 'string') {
    return detail;
  }
  if (typeof detail === 'object' && typeof detail?.message === 'string') {
    return detail.message;
  }

  return collectErrorStrings(data).join(' ') || undefined;
}
