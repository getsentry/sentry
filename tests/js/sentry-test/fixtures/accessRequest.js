import {Team} from './team';
import {Member} from './member';

export function AccessRequest(params = {}) {
  return {
    id: '123',
    member: Member(),
    team: Team(),
    requester: null,
    ...params,
  };
}
