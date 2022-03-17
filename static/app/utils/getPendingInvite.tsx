import Cookies from 'js-cookie';
import * as qs from 'query-string';

export type PendingInvite = {
  memberId: number;
  token: string;
  url: string;
};

function isPendingInvite(invite: any): invite is PendingInvite {
  return 'memberId' in invite && 'token' in invite && 'url' in invite;
}

export default function getPendingInvite(): PendingInvite | null {
  const rawPendingInviteCookie = Cookies.get('pending-invite');

  if (rawPendingInviteCookie) {
    const parsedPendingInvite = qs.parse(rawPendingInviteCookie);

    if (isPendingInvite(parsedPendingInvite)) {
      return parsedPendingInvite;
    }

    return null;
  }

  return null;
}
