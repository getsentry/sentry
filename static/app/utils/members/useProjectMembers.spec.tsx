import {MemberFixture} from 'sentry-fixture/member';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {UserFixture} from 'sentry-fixture/user';

import {renderHookWithProviders, waitFor} from 'sentry-test/reactTestingLibrary';

import {indexMembersByProject, selectUsersFromMembers} from 'sentry/utils/members/shared';
import {useProjectMembers} from 'sentry/utils/members/useProjectMembers';

describe('useProjectMembers', () => {
  const organization = OrganizationFixture();

  it('selects users from members', () => {
    const user = UserFixture();
    const members = [MemberFixture({role: 'owner', user}), MemberFixture({user: null})];

    expect(selectUsersFromMembers(members)).toEqual([{...user, role: 'owner'}]);
  });

  it('indexes members by project', () => {
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

  it('fetches organization users', async () => {
    const user = UserFixture();
    const member = MemberFixture({user});
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/users/`,
      body: [member],
    });

    const {result} = renderHookWithProviders(() => useProjectMembers(), {
      organization,
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual([member]);
  });

  it('fetches project-filtered organization users', async () => {
    const user = UserFixture();
    const member = MemberFixture({user});
    const mockRequest = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/users/`,
      body: [member],
      match: [MockApiClient.matchQuery({project: ['1', '2']})],
    });

    const {result} = renderHookWithProviders(
      () => useProjectMembers({projectIds: ['2', 1, '1', '2']}),
      {organization}
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual([member]);
    expect(mockRequest).toHaveBeenCalled();
  });
});
