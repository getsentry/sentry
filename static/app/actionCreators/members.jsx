import MemberActions from 'app/actions/memberActions';
import MemberListStore from 'app/stores/memberListStore';

export function fetchOrgMembers(api, orgId, projectIds = null) {
  const endpoint = `/organizations/${orgId}/users/`;
  const query = projectIds ? {project: projectIds} : null;

  const promise = api.requestPromise(endpoint, {method: 'GET', query});
  return promise.then(members => {
    members = members.filter(m => m.user);

    // Update the store with just the users, as avatars rely on them.
    MemberListStore.loadInitialData(members.map(m => m.user));

    return members;
  });
}

export function fetchProjectMembers(api, orgId, projectId) {
  const url = `/projects/${orgId}/${projectId}/members/`;
  return api.requestPromise(url, {method: 'GET'}).then(members => {
    members = members.filter(m => m.user).map(m => m.user);
    MemberListStore.loadInitialData(members);

    return members;
  });
}

/**
 * Convert a list of members with user & project data
 * into a object that maps project slugs : users in that project.
 */
export function indexMembersByProject(members) {
  return members.reduce((acc, member) => {
    for (const project of member.projects) {
      if (acc[project] === undefined) {
        acc[project] = [];
      }
      acc[project].push(member.user);
    }
    return acc;
  }, {});
}

export function updateMember(api, params) {
  MemberActions.update(params.memberId, params.data);

  const endpoint = `/organizations/${params.orgId}/members/${params.memberId}/`;
  return new Promise((resolve, reject) =>
    api.request(endpoint, {
      method: 'PUT',
      data: params.data,
      success: data => {
        MemberActions.updateSuccess(data);
        resolve(data);
      },
      error: data => {
        MemberActions.updateError(data);
        reject(data);
      },
    })
  );
}

export function resendMemberInvite(api, params) {
  MemberActions.resendMemberInvite(params.orgId, params.data);

  const endpoint = `/organizations/${params.orgId}/members/${params.memberId}/`;
  return new Promise((resolve, reject) =>
    api.request(endpoint, {
      method: 'PUT',
      data: {
        regenerate: params.regenerate,
        reinvite: true,
      },
      success: data => {
        MemberActions.resendMemberInviteSuccess(data);
        resolve(data);
      },
      error: data => {
        MemberActions.resendMemberInviteError(data);
        reject(data);
      },
    })
  );
}
