import type {UseQueryResult} from '@tanstack/react-query';
import {useQuery} from '@tanstack/react-query';

import type {Member} from 'sentry/types/organization';
import type {User} from 'sentry/types/user';
import {apiOptions} from 'sentry/utils/api/apiOptions';
import {useOrganization} from 'sentry/utils/useOrganization';

type ProjectId = number | string;

type OrganizationUsersQueryOptions = {
  orgSlug: string;
  projectIds?: readonly ProjectId[] | null;
  staleTime?: number;
};

type UseOrganizationUsersOptions<TData> = {
  enabled?: boolean;
  projectIds?: readonly ProjectId[] | null;
  select?: (members: Member[]) => TData;
  staleTime?: number;
};

function normalizeProjectIds(projectIds: readonly ProjectId[] | null | undefined) {
  if (!projectIds?.length) {
    return;
  }

  const normalized = Array.from(new Set(projectIds.map(String))).sort();

  return normalized.length ? normalized : undefined;
}

export function selectUsersFromMembers(members: Member[]): User[] {
  return members
    .filter((member): member is Member & {user: NonNullable<Member['user']>} =>
      Boolean(member.user)
    )
    .map(member => ({
      ...member.user,
      role: member.role,
    }));
}

export type IndexedMembersByProject = Record<string, User[]>;

/**
 * Convert a list of members with user & project data into an object that maps
 * project slugs to users in that project.
 */
export function indexMembersByProject(members: Member[]): IndexedMembersByProject {
  return members.reduce<IndexedMembersByProject>((acc, member) => {
    for (const project of member.projects) {
      if (!acc.hasOwnProperty(project)) {
        acc[project] = [];
      }
      if (member.user) {
        acc[project]!.push(member.user);
      }
    }
    return acc;
  }, {});
}

export function organizationUsersQueryOptions({
  orgSlug,
  projectIds,
  staleTime = 30_000,
}: OrganizationUsersQueryOptions) {
  return apiOptions.as<Member[]>()('/organizations/$organizationIdOrSlug/users/', {
    path: {organizationIdOrSlug: orgSlug},
    query: {project: normalizeProjectIds(projectIds)},
    staleTime,
  });
}

export function useOrganizationUsers<TData = Member[]>({
  enabled = true,
  projectIds,
  select,
  staleTime,
}: UseOrganizationUsersOptions<TData> = {}): UseQueryResult<TData> {
  const organization = useOrganization();
  const query = useQuery({
    ...organizationUsersQueryOptions({
      orgSlug: organization.slug,
      projectIds,
      staleTime,
    }),
    enabled,
  });
  const data = query.data && select ? select(query.data) : query.data;

  return Object.assign({}, query, {data}) as UseQueryResult<TData>;
}
