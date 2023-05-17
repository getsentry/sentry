import * as Sentry from '@sentry/react';

import {addErrorMessage} from 'sentry/actionCreators/indicator';
import {Client} from 'sentry/api';
import {t} from 'sentry/locale';
import MemberListStore from 'sentry/stores/memberListStore';
import {Member, User} from 'sentry/types';

function getMemberUser(member: Member) {
  return {
    ...member.user,
    role: member.role,
  };
}

export async function fetchOrgMembers(
  api: Client,
  orgId: string,
  projectIds: string[] | null = null
): Promise<Member[]> {
  const endpoint = `/organizations/${orgId}/users/`;
  const query = projectIds ? {project: projectIds} : {};

  try {
    const members = await api.requestPromise(endpoint, {method: 'GET', query});

    if (!members) {
      // This shouldn't happen if the request was successful
      // It should at least be an empty list
      Sentry.withScope(scope => {
        scope.setExtras({
          orgId,
          projectIds,
        });
        Sentry.captureException(new Error('Members is undefined'));
      });
    }

    const memberUsers = members?.filter(({user}: Member) => user);

    if (!memberUsers) {
      return [];
    }

    // Update the store with just the users, as avatars rely on them.
    MemberListStore.loadInitialData(memberUsers.map(getMemberUser));

    return members;
  } catch (err) {
    addErrorMessage(t('Unable to load organization members'));
  }

  return [];
}

export type IndexedMembersByProject = Record<string, User[]>;

/**
 * Convert a list of members with user & project data
 * into a object that maps project slugs : users in that project.
 */
export function indexMembersByProject(members: Member[]): IndexedMembersByProject {
  return members.reduce<IndexedMembersByProject>((acc, member) => {
    for (const project of member.projects) {
      if (!acc.hasOwnProperty(project)) {
        acc[project] = [];
      }
      if (member.user) {
        acc[project].push(member.user);
      }
    }
    return acc;
  }, {});
}

type UpdateMemberOptions = {
  data: Member | null;
  memberId: string;
  orgId: string;
};

export function updateMember(api: Client, {orgId, memberId, data}: UpdateMemberOptions) {
  return api.requestPromise(`/organizations/${orgId}/members/${memberId}/`, {
    method: 'PUT',
    data,
  });
}

type ResendMemberInviteOptions = {
  memberId: string;
  orgId: string;
  regenerate?: boolean;
};

export function resendMemberInvite(
  api: Client,
  {orgId, memberId, regenerate}: ResendMemberInviteOptions
) {
  return api.requestPromise(`/organizations/${orgId}/members/${memberId}/`, {
    method: 'PUT',
    data: {
      regenerate,
      reinvite: true,
    },
  });
}
