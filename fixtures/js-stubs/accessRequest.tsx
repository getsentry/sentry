import {MemberFixture} from 'sentry-fixture/member';
import {TeamFixture} from 'sentry-fixture/team';

import {AccessRequest as AccessRequestType} from 'sentry/types';

export function AccessRequestFixture(
  params: Partial<AccessRequestType> = {}
): AccessRequestType {
  return {
    id: '123',
    member: MemberFixture(),
    team: TeamFixture(),
    ...params,
  };
}
