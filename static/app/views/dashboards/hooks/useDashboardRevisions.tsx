import {useQuery} from '@tanstack/react-query';

import {apiOptions} from 'sentry/utils/api/apiOptions';
import {useOrganization} from 'sentry/utils/useOrganization';

export type DashboardRevision = {
  createdBy: {email: string; id: string; name: string} | null;
  dateCreated: string;
  id: string;
  source: 'edit' | 'pre-restore';
  title: string;
};

interface UseDashboardRevisionsOptions {
  dashboardId: string;
}

export function useDashboardRevisions({dashboardId}: UseDashboardRevisionsOptions) {
  const organization = useOrganization();
  return useQuery(
    apiOptions.as<DashboardRevision[]>()(
      '/organizations/$organizationIdOrSlug/dashboards/$dashboardId/revisions/',
      {
        path: {organizationIdOrSlug: organization.slug, dashboardId},
        staleTime: 30_000,
      }
    )
  );
}
