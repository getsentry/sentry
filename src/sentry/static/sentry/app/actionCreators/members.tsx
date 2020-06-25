import * as Sentry from '@sentry/react';

import {Client} from 'app/api';
import {Member} from 'app/types';
import MemberActions from 'app/actions/memberActions';
import MemberListStore from 'app/stores/memberListStore';

function getMemberUser(member: Member) {
  return {
    ...member.user,
    role: member.role,
  };
}

export async function fetchOrgMembers(
  api: Client,
  orgId: string,
  projectIds: number[] | null = null
) {
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
    Sentry.setExtras({
      resp: err,
    });
    Sentry.captureException(err);
  }

  return [];
}

type IndexedMembersByProject = {
  [key: string]: Member['user'][];
};

/**
 * Convert a list of members with user & project data
 * into a object that maps project slugs : users in that project.
 */
export function indexMembersByProject(members: Member[]): IndexedMembersByProject {
  return members.reduce((acc, member) => {
    for (const project of member.projects) {
      if (!acc.hasOwnProperty(project)) {
        acc[project] = [];
      }
      acc[project].push(member.user);
    }
    return acc;
  }, {});
}

type UpdateMemberOptions = {
  orgId: string;
  memberId: string;
  data: Member | null;
};

export async function updateMember(
  api: Client,
  {orgId, memberId, data}: UpdateMemberOptions
) {
  MemberActions.update(memberId, data);

  const endpoint = `/organizations/${orgId}/members/${memberId}/`;
  try {
    const resp = await api.requestPromise(endpoint, {
      method: 'PUT',
      data,
    });
    MemberActions.updateSuccess(resp);
    return resp;
  } catch (err) {
    MemberActions.updateError(err);
    throw err;
  }
}

type ResendMemberInviteOptions = {
  orgId: string;
  memberId: string;
  regenerate?: boolean;
  data?: object;
};

export async function resendMemberInvite(
  api: Client,
  {orgId, memberId, regenerate, data}: ResendMemberInviteOptions
) {
  MemberActions.resendMemberInvite(orgId, data);

  const endpoint = `/organizations/${orgId}/members/${memberId}/`;
  try {
    const resp = await api.requestPromise(endpoint, {
      method: 'PUT',
      data: {
        regenerate,
        reinvite: true,
      },
    });
    MemberActions.resendMemberInviteSuccess(resp);
    return resp;
  } catch (err) {
    MemberActions.resendMemberInviteError(err);
    throw err;
  }
}

export function getCurrentMember(api: Client, orgId: string) {
  return api.requestPromise(`/organizations/${orgId}/members/me/`);
}
