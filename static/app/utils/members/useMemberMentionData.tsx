import {useCallback, useMemo} from 'react';
import type {DataFunc, SuggestionDataItem} from 'react-mentions';
import {useQueryClient} from '@tanstack/react-query';
import uniqBy from 'lodash/uniqBy';

import type {Member} from 'sentry/types/organization';
import type {User} from 'sentry/types/user';
import type {ApiResponse} from 'sentry/utils/api/apiFetch';
import {memberUsersQueryOptions} from 'sentry/utils/members/shared';
import {useOrganizationMemberSearch} from 'sentry/utils/members/useOrganizationMemberSearch';
import {useOrganization} from 'sentry/utils/useOrganization';

function userToSuggestion(user: User): SuggestionDataItem {
  return {
    id: `user:${user.id}`,
    display: user.name || user.email || user.username || user.id,
  };
}

function getUsersFromResponse(response: ApiResponse<Member[]> | User[]) {
  if (Array.isArray(response)) {
    return response;
  }

  return response.json.map(member => member.user).filter((user): user is User => !!user);
}

/**
 * Adapts organization member search to react-mentions' async callback API.
 * When mentions move to the modern member selector flow, this hook can go away.
 */
export function useMemberMentionData() {
  const organization = useOrganization();
  const queryClient = useQueryClient();
  const {members} = useOrganizationMemberSearch();

  const memberSuggestions = useMemo(() => members.map(userToSuggestion), [members]);

  const getMemberSuggestions = useCallback<DataFunc>(
    async (query, callback) => {
      const search = query.trim();

      if (!search) {
        callback(memberSuggestions);
        return;
      }

      try {
        const response = await queryClient.fetchQuery(
          memberUsersQueryOptions({
            orgSlug: organization.slug,
            search,
          })
        );
        const matchingMembers = getUsersFromResponse(response);

        callback(
          uniqBy([...matchingMembers, ...members], ({id}) => id).map(userToSuggestion)
        );
      } catch {
        callback(memberSuggestions);
      }
    },
    [memberSuggestions, members, organization.slug, queryClient]
  );

  return {getMemberSuggestions};
}
