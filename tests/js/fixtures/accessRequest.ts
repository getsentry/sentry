import {MemberFixture} from 'sentry-fixture/member';
import {TeamFixture} from 'sentry-fixture/team';

import type {AccessRequest} from 'sentry/types/organization';

export function AccessRequestFixture(params: Partial<AccessRequest> = {}): AccessRequest {
  return {
    id: '123',
    member: MemberFixture(),
    team: TeamFixture(),
    ...params,
  };
}
