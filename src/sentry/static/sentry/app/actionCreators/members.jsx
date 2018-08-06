import MemberActions from 'app/actions/memberActions';

export function updateMember(api, params) {
  MemberActions.update(params.memberId, params.data);

  let endpoint = `/organizations/${params.orgId}/members/${params.memberId}/`;
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

  let endpoint = `/organizations/${params.orgId}/members/${params.memberId}/`;
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
