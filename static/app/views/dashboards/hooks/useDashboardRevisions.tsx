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

export function makeDashboardRevisionsQueryOptions(orgSlug: string, dashboardId: string) {
  return apiOptions.as<DashboardRevision[]>()(
    '/organizations/$organizationIdOrSlug/dashboards/$dashboardId/revisions/',
    {
      path: {organizationIdOrSlug: orgSlug, dashboardId},
      staleTime: 30_000,
    }
  );
}

interface UseDashboardRevisionsOptions {
  dashboardId: string;
}

export function useDashboardRevisions({dashboardId}: UseDashboardRevisionsOptions) {
  const organization = useOrganization();
  return useQuery(makeDashboardRevisionsQueryOptions(organization.slug, dashboardId));
}
