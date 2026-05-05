import {useQuery} from '@tanstack/react-query';
import {MemberFixture} from 'sentry-fixture/member';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {UserFixture} from 'sentry-fixture/user';

import {renderHookWithProviders, waitFor} from 'sentry-test/reactTestingLibrary';

import {useProjectMembersQueryOptions} from 'sentry/utils/members/projectMembers';

describe('useProjectMembersQueryOptions', () => {
  const organization = OrganizationFixture();

  it('fetches organization users', async () => {
    const user = UserFixture();
    const member = MemberFixture({user});
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/users/`,
      body: [member],
    });

    const {result} = renderHookWithProviders(
      () => useQuery(useProjectMembersQueryOptions()),
      {organization}
    );

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
      () => useQuery(useProjectMembersQueryOptions(['2', 1, '1', '2'])),
      {organization}
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual([member]);
    expect(mockRequest).toHaveBeenCalled();
  });
});
