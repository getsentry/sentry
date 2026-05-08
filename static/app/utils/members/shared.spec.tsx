import {MemberFixture} from 'sentry-fixture/member';
import {UserFixture} from 'sentry-fixture/user';

import {indexMembersByProject} from 'sentry/utils/members/shared';

describe('indexMembersByProject', () => {
  it('maps project slugs to their users', () => {
    const user = UserFixture();
    const otherUser = UserFixture();

    expect(
      indexMembersByProject([
        MemberFixture({projects: ['foo', 'bar'], user}),
        MemberFixture({projects: ['foo'], user: otherUser}),
        MemberFixture({projects: ['foo'], user: null}),
      ])
    ).toEqual({
      bar: [user],
      foo: [user, otherUser],
    });
  });
});
