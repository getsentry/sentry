import type {Member} from 'sentry/types/organization';
import {apiOptions} from 'sentry/utils/api/apiOptions';
import {useOrganization} from 'sentry/utils/useOrganization';

type ProjectId = number | string;

function normalizeProjectIds(projectIds: readonly ProjectId[] | null | undefined) {
  if (!projectIds?.length) {
    return;
  }

  const normalized = Array.from(new Set(projectIds.map(String))).sort();

  return normalized.length ? normalized : undefined;
}

interface ProjectMembersQueryOptions {
  orgSlug: string;
  projectIds?: readonly ProjectId[] | null;
}

function projectMembersQueryOptions({orgSlug, projectIds}: ProjectMembersQueryOptions) {
  return apiOptions.as<Member[]>()('/organizations/$organizationIdOrSlug/users/', {
    path: {organizationIdOrSlug: orgSlug},
    query: {project: normalizeProjectIds(projectIds)},
    staleTime: 30_000,
  });
}

export function useProjectMembersQueryOptions(projectIds?: readonly ProjectId[] | null) {
  const organization = useOrganization();
  return projectMembersQueryOptions({
    orgSlug: organization.slug,
    projectIds,
  });
}
