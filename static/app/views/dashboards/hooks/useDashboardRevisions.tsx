import {useMemo} from 'react';
import {skipToken, useQuery} from '@tanstack/react-query';

import type {Avatar} from 'sentry/types/core';
import type {AvatarUser} from 'sentry/types/user';
import {apiOptions} from 'sentry/utils/api/apiOptions';
import {useOrganization} from 'sentry/utils/useOrganization';
import type {DashboardDetails} from 'sentry/views/dashboards/types';

// Sparse user shape that both the API response (after normalization) and a full
// User object satisfy, so callers can pass either without mapping.
type RevisionCreatedBy = Pick<
  AvatarUser,
  'id' | 'name' | 'email' | 'avatar' | 'avatarUrl'
>;

// Raw shape returned by the revisions API — avatarType/avatarUrl are flat fields.
type RawRevisionCreatedBy = {
  email: string;
  id: string;
  name: string;
  avatarType?: Avatar['avatarType'] | null;
  avatarUrl?: string | null;
};

type RawDashboardRevision = {
  createdBy: RawRevisionCreatedBy | null;
  dateCreated: string;
  id: string;
  source: 'edit' | 'edit-with-agent' | 'pre-restore';
  title: string;
};

export type DashboardRevision = {
  createdBy: RevisionCreatedBy | null;
  dateCreated: string;
  id: string;
  source: 'edit' | 'edit-with-agent' | 'pre-restore';
  title: string;
};

function normalizeRevision(raw: RawDashboardRevision): DashboardRevision {
  return {
    id: raw.id,
    dateCreated: raw.dateCreated,
    source: raw.source,
    title: raw.title,
    createdBy: raw.createdBy
      ? {
          id: raw.createdBy.id,
          name: raw.createdBy.name,
          email: raw.createdBy.email,
          avatarUrl: raw.createdBy.avatarUrl ?? undefined,
          avatar: raw.createdBy.avatarType
            ? {
                avatarType: raw.createdBy.avatarType,
                avatarUrl: raw.createdBy.avatarUrl ?? null,
                avatarUuid: null,
              }
            : undefined,
        }
      : null,
  };
}

const REVISIONS_PATH =
  '/organizations/$organizationIdOrSlug/dashboards/$dashboardId/revisions/' as const;

export function getDashboardRevisionsQueryKey(orgSlug: string, dashboardId: string) {
  return apiOptions.as<RawDashboardRevision[]>()(REVISIONS_PATH, {
    path: {organizationIdOrSlug: orgSlug, dashboardId},
    staleTime: 30_000,
  }).queryKey;
}

interface UseDashboardRevisionsOptions {
  dashboardId: string;
}

export function useDashboardRevisions({dashboardId}: UseDashboardRevisionsOptions) {
  const organization = useOrganization();
  const {data, isPending, isError} = useQuery(
    apiOptions.as<RawDashboardRevision[]>()(REVISIONS_PATH, {
      path: {organizationIdOrSlug: organization.slug, dashboardId},
      staleTime: 30_000,
    })
  );
  const normalizedData = useMemo(() => data?.map(normalizeRevision), [data]);
  return {data: normalizedData, isPending, isError};
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
