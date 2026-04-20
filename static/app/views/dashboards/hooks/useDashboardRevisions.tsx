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

const REVISIONS_PATH =
  '/organizations/$organizationIdOrSlug/dashboards/$dashboardId/revisions/' as const;

export function getDashboardRevisionsQueryKey(orgSlug: string, dashboardId: string) {
  return apiOptions.as<DashboardRevision[]>()(REVISIONS_PATH, {
    path: {organizationIdOrSlug: orgSlug, dashboardId},
    staleTime: 30_000,
  }).queryKey;
}

interface UseDashboardRevisionsOptions {
  dashboardId: string;
}

export function useDashboardRevisions({dashboardId}: UseDashboardRevisionsOptions) {
  const organization = useOrganization();
  return useQuery(
    apiOptions.as<DashboardRevision[]>()(REVISIONS_PATH, {
      path: {organizationIdOrSlug: organization.slug, dashboardId},
      staleTime: 30_000,
    })
  );
}
