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

function getMembersQuery({ids, search, limit}: FetchMemberOptions = {}) {
  const query: {
    per_page?: number;
    query?: string;
  } = {};

  const queryTerms = [...normalizeMemberValues(ids).map(id => `user.id:${id}`)];

  if (search) {
    queryTerms.push(search);
  }

  if (queryTerms.length > 0) {
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
      staleTime: Infinity,
    }),
    select: selectUsersFromResponse,
  };
}
