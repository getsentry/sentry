import {AccessRequest as AccessRequestType} from 'sentry/types';

import {Member} from './member';
import {Team} from './team';

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
