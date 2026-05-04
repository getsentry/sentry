import {useCallback} from 'react';
import type {UseQueryResult} from '@tanstack/react-query';
import {useQuery} from '@tanstack/react-query';

import type {Member} from 'sentry/types/organization';
import type {ApiResponse} from 'sentry/utils/api/apiFetch';
import {apiOptions} from 'sentry/utils/api/apiOptions';
import {useOrganization} from 'sentry/utils/useOrganization';

type ProjectId = number | string;

interface ProjectMembersQueryOptions {
  orgSlug: string;
  projectIds?: readonly ProjectId[] | null;
  staleTime?: number;
}

interface UseProjectMembersOptions<TData> {
  enabled?: boolean;
  projectIds?: readonly ProjectId[] | null;
  select?: (members: Member[]) => TData;
  staleTime?: number;
}

function normalizeProjectIds(projectIds: readonly ProjectId[] | null | undefined) {
  if (!projectIds?.length) {
    return;
  }

  const normalized = Array.from(new Set(projectIds.map(String))).sort();

  return normalized.length ? normalized : undefined;
}

function projectMembersQueryOptions({
  orgSlug,
  projectIds,
  staleTime = 30_000,
}: ProjectMembersQueryOptions) {
  return apiOptions.as<Member[]>()('/organizations/$organizationIdOrSlug/users/', {
    path: {organizationIdOrSlug: orgSlug},
    query: {project: normalizeProjectIds(projectIds)},
    staleTime,
  });
}

export function useProjectMembers<TData = Member[]>({
  enabled = true,
  projectIds,
  select,
  staleTime,
}: UseProjectMembersOptions<TData> = {}): UseQueryResult<TData> {
  const organization = useOrganization();
  const selectOrganizationMembers = useCallback(
    (response: ApiResponse<Member[]>) =>
      (select ? select(response.json) : response.json) as TData,
    [select]
  );

  return useQuery({
    ...projectMembersQueryOptions({
      orgSlug: organization.slug,
      projectIds,
      staleTime,
    }),
    enabled,
    select: selectOrganizationMembers,
  });
}
