import Cookies from 'js-cookie';
import * as queryString from 'query-string';

type PendingInvite = {
  memberId: number;
  token: string;
  url: string;
};

export default function getPendingInvite(): PendingInvite | null {
  const data = Cookies.get('pending-invite');

  if (!data) {
    return null;
  }

  return queryString.parse(data) as any;
}
