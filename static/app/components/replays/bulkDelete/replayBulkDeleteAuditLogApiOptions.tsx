import {queryOptions} from '@tanstack/react-query';

import type {ReplayBulkDeleteAuditLog} from 'sentry/components/replays/bulkDelete/types';
import type {Organization} from 'sentry/types/organization';
import {apiOptions} from 'sentry/utils/api/apiOptions';

type Query = {
  referrer: string;
  offset?: number;
  per_page?: number;
};

export function replayBulkDeleteAuditLogApiOptions(
  organization: Organization,
  {
    projectSlug,
    query,
  }: {
    projectSlug: string;
    query: Query;
  }
) {
  return queryOptions({
    ...apiOptions.as<{data: ReplayBulkDeleteAuditLog[]}>()(
      '/projects/$organizationIdOrSlug/$projectIdOrSlug/replays/jobs/delete/',
      {
        path: {organizationIdOrSlug: organization.slug, projectIdOrSlug: projectSlug},
        query,
        staleTime: 0,
      }
    ),
    refetchInterval: 1_000,
    retry: false,
  });
}
