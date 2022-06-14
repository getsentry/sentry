import {Member} from './member';
import {Team} from './team';

export function AccessRequest(params = {}) {
  return {
    id: '123',
    member: Member(),
    team: Team(),
    requester: null,
    ...params,
  };
}
