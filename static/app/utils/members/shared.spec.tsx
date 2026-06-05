import {MemberFixture} from 'sentry-fixture/member';
import {UserFixture} from 'sentry-fixture/user';

import {indexMembersByProject} from 'sentry/utils/members/shared';

describe('indexMembersByProject', () => {
  it('maps project slugs to their users', () => {
    const user = UserFixture();
    const otherUser = UserFixture();

    const result = indexMembersByProject([
      MemberFixture({projects: ['foo', 'bar'], user}),
      MemberFixture({projects: ['foo'], user: otherUser}),
      MemberFixture({projects: ['foo'], user: null}),
    ]);

    expect(result.get('bar')).toEqual([user]);
    expect(result.get('foo')).toEqual([user, otherUser]);
  });

  it('handles project slugs that overlap with Object prototype keys', () => {
    const user = UserFixture();

    const result = indexMembersByProject([
      MemberFixture({projects: ['constructor'], user}),
    ]);

    expect(result.get('constructor')).toEqual([user]);
  });
});
