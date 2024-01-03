import {MemberFixture} from 'sentry-fixture/member';
import {TeamFixture} from 'sentry-fixture/team';

import {AccessRequest} from 'sentry/types';

export function AccessRequestFixture(params: Partial<AccessRequest> = {}): AccessRequest {
  return {
    id: '123',
    member: MemberFixture(),
    team: TeamFixture(),
    ...params,
  };
}
