import Cookies from 'js-cookie';

import {parse} from './url/qs';

type PendingInvite = {
  memberId: number;
  token: string;
  url: string;
};

export function getPendingInvite(): PendingInvite | null {
  const data = Cookies.get('pending-invite');

  if (!data) {
    return null;
  }

  return parse(data) as any;
}
