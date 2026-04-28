import {skipToken, useQuery} from '@tanstack/react-query';

import {apiOptions} from 'sentry/utils/api/apiOptions';
import {useOrganization} from 'sentry/utils/useOrganization';
import type {DashboardDetails} from 'sentry/views/dashboards/types';

export type DashboardRevision = {
  createdBy: {email: string; id: string; name: string; avatarUrl?: string | null} | null;
  dateCreated: string;
  id: string;
  source: 'edit' | 'edit-with-agent' | 'pre-restore';
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

const REVISION_DETAILS_PATH =
  '/organizations/$organizationIdOrSlug/dashboards/$dashboardId/revisions/$revisionId/' as const;

interface UseDashboardRevisionDetailsOptions {
  dashboardId: string;
  revisionId: string | null;
}

export function useDashboardRevisionDetails({
  dashboardId,
  revisionId,
}: UseDashboardRevisionDetailsOptions) {
  const organization = useOrganization();
  return useQuery(
    apiOptions.as<DashboardDetails>()(REVISION_DETAILS_PATH, {
      path: revisionId
        ? {organizationIdOrSlug: organization.slug, dashboardId, revisionId}
        : skipToken,
      staleTime: 3_600_000,
    })
  );
}
