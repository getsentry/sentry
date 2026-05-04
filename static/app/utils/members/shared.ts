import uniqBy from 'lodash/uniqBy';

import type {Member} from 'sentry/types/organization';
import type {User} from 'sentry/types/user';
import type {ApiResponse} from 'sentry/utils/api/apiFetch';
import {apiOptions, selectJsonWithHeaders} from 'sentry/utils/api/apiOptions';
import type {RequestError} from 'sentry/utils/requestError/requestError';

export type MemberResult = {
  /**
   * The error that occurred if fetching failed.
   */
  fetchError: null | RequestError;
  /**
   * This is state for when fetching data from API.
   */
  fetching: boolean;
  /**
   * Reflects whether or not the initial fetch for the requested users was
   * fulfilled.
   */
  initiallyLoaded: boolean;
  /**
   * The loaded organization member users.
   */
  members: User[];
};

export type MemberSearchResult = MemberResult & {
  /**
   * Updates the current member search query.
   */
  onSearch: (searchTerm: string) => Promise<void>;
};

export type FetchMemberOptions = {
  emails?: string[];
  ids?: string[];
  limit?: number;
  search?: null | string;
};

export type MembersQueryOptions = FetchMemberOptions & {
  orgSlug: string;
};

function normalizeMemberValues(values: string[] | undefined) {
  return values ? Array.from(new Set(values)).sort() : [];
}

function getMembersQuery({emails, ids, search, limit}: FetchMemberOptions = {}) {
  const query: {
    per_page?: number;
    query?: string;
  } = {};

  const queryTerms = [
    ...normalizeMemberValues(ids).map(id => `user.id:${id}`),
    ...normalizeMemberValues(emails).map(email => `email:${email}`),
  ];

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

export function membersQueryOptions({orgSlug, ...options}: MembersQueryOptions) {
  return {
    ...apiOptions.as<Member[]>()('/organizations/$organizationIdOrSlug/members/', {
      path: {organizationIdOrSlug: orgSlug},
      query: getMembersQuery(options),
      staleTime: 30_000,
    }),
    select: selectJsonWithHeaders,
  };
}

function getMemberUsers(members: Member[]) {
  return members.map(m => m.user).filter((user): user is User => user !== null);
}

export function uniqueMembers(...memberLists: User[][]) {
  return uniqBy<User>(memberLists.flat(), ({id}) => id);
}

export function selectMemberUsersFromResponse(response: ApiResponse<Member[]>): User[] {
  return getMemberUsers(response.json);
}
