import type {Client} from 'sentry/api';
import type {Member} from 'sentry/types/organization';
import {getApiUrl} from 'sentry/utils/api/getApiUrl';

type UpdateMemberOptions = {
  data: Member | null;
  memberId: string;
  orgId: string;
};

export function updateMember(api: Client, {orgId, memberId, data}: UpdateMemberOptions) {
  return api.requestPromise(
    getApiUrl('/organizations/$organizationIdOrSlug/members/$memberId/', {
      path: {organizationIdOrSlug: orgId, memberId},
    }),
    {
      method: 'PUT',
      data,
    }
  );
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
  return api.requestPromise(
    getApiUrl('/organizations/$organizationIdOrSlug/members/$memberId/', {
      path: {organizationIdOrSlug: orgId, memberId},
    }),
    {
      method: 'PUT',
      data: {
        regenerate,
        reinvite: true,
      },
    }
  );
}
