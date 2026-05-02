import {MemberFixture} from 'sentry-fixture/member';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {UserFixture} from 'sentry-fixture/user';

import {renderHookWithProviders, waitFor} from 'sentry-test/reactTestingLibrary';

import {
  indexMembersByProject,
  organizationMembersQueryOptions,
  selectUsersFromMembers,
  useOrganizationMembers,
} from 'sentry/utils/useOrganizationMembers';

describe('useOrganizationMembers', () => {
  const organization = OrganizationFixture();

  it('normalizes project ids for the query key', () => {
    const options = organizationMembersQueryOptions({
      orgSlug: organization.slug,
      projectIds: ['2', 1, '1', '2'],
    });

    expect(options.queryKey).toEqual([
      {infinite: false, version: 'v2'},
      `/organizations/${organization.slug}/users/`,
      {query: {project: ['1', '2']}},
    ]);
  });

  it('omits the project query for empty project ids', () => {
    const options = organizationMembersQueryOptions({
      orgSlug: organization.slug,
      projectIds: [],
    });

    expect(options.queryKey).toEqual([
      {infinite: false, version: 'v2'},
      `/organizations/${organization.slug}/users/`,
    ]);
  });

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

    const {result} = renderHookWithProviders(() => useOrganizationMembers(), {
      organization,
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual([member]);
  });
});
