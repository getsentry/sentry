import type {Member} from 'sentry/types/organization';
import type {User} from 'sentry/types/user';
import type {ApiResponse} from 'sentry/utils/api/apiFetch';
import {apiOptions} from 'sentry/utils/api/apiOptions';
import type {RequestError} from 'sentry/utils/requestError/requestError';

export interface MemberResult {
  /**
   * The query error, if fetching failed.
   */
  error: null | RequestError;
  /**
   * Reflects whether the query has resolved at least once.
   */
  isFetched: boolean;
  /**
   * True while the query is waiting on its first response.
   */
  isPending: boolean;
  /**
   * The loaded organization member users.
   */
  members: User[];
}

export type IndexedMembersByProject = Record<string, User[]>;

interface FetchMemberOptions {
  ids?: string[];
  limit?: number;
  search?: null | string;
}

interface MembersQueryOptions extends FetchMemberOptions {
  orgSlug: string;
}

export function normalizeMemberValues(values: string[] | undefined) {
  return values ? Array.from(new Set(values)).sort() : [];
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

function getMembersQuery({ids, search, limit}: FetchMemberOptions = {}) {
  const query: {
    per_page?: number;
    query?: string;
  } = {};

  const normalizedIds = normalizeMemberValues(ids);
  const queryTerms = [...normalizedIds.map(id => `user.id:${id}`)];

  if (search) {
    queryTerms.push(search);
  }

  if (ids !== undefined || queryTerms.length > 0) {
    query.query = queryTerms.join(' ');
  }

  if (limit !== undefined) {
    query.per_page = limit;
  }

  return query;
}

function selectUsersFromResponse({json}: ApiResponse<Member[]>) {
  return json.map(m => m.user).filter((user): user is User => user !== null);
}

export function memberUsersQueryOptions(options: MembersQueryOptions) {
  return {
    ...apiOptions.as<Member[]>()('/organizations/$organizationIdOrSlug/members/', {
      path: {organizationIdOrSlug: options.orgSlug},
      query: getMembersQuery(options),
      staleTime: 10 * 60 * 1000,
    }),
    select: selectUsersFromResponse,
  };
}
