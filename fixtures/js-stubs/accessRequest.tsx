import {Member} from 'sentry-fixture/member';
import {Team} from 'sentry-fixture/team';

import {AccessRequest as AccessRequestType} from 'sentry/types';

export function AccessRequest(
  params: Partial<AccessRequestType> = {}
): AccessRequestType {
  return {
    id: '123',
    member: Member(),
    team: Team(),
    ...params,
  };
}
