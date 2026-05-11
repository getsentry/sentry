import {OrganizationFixture} from 'sentry-fixture/organization';
import {UserFixture} from 'sentry-fixture/user';

import {renderHookWithProviders, waitFor} from 'sentry-test/reactTestingLibrary';

import {useMembers} from 'sentry/utils/members/useMembers';

describe('useMembers', () => {
  const org = OrganizationFixture();

  const mockUsers = [UserFixture()];

  it('provides organization member users from the members endpoint', async () => {
    const mockRequest = MockApiClient.addMockResponse({
      url: `/organizations/${org.slug}/members/`,
      method: 'GET',
      body: mockUsers.map(user => ({user})),
    });

    const {result} = renderHookWithProviders(useMembers, {
      organization: org,
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockRequest).toHaveBeenCalled();
    expect(result.current.data).toEqual(mockUsers);
  });

  it('does not request members when disabled for empty ids', () => {
    const mockRequest = MockApiClient.addMockResponse({
      url: `/organizations/${org.slug}/members/`,
      method: 'GET',
      body: mockUsers.map(user => ({user})),
    });

    const {result} = renderHookWithProviders(useMembers, {
      initialProps: {enabled: false, ids: []},
      organization: org,
    });

    expect(result.current.isFetching).toBe(false);
    expect(result.current.data).toBeUndefined();
    expect(mockRequest).not.toHaveBeenCalled();
  });

  it('provides only the specified ids', async () => {
    const userFoo = UserFixture({id: '10'});
    const mockRequest = MockApiClient.addMockResponse({
      url: `/organizations/${org.slug}/members/`,
      method: 'GET',
      body: [{user: userFoo}],
    });

    const {result} = renderHookWithProviders(useMembers, {
      initialProps: {ids: ['10']},
      organization: org,
    });

    expect(result.current.isFetched).toBe(false);

    await waitFor(() => expect(result.current.data).toHaveLength(1));

    expect(mockRequest).toHaveBeenCalled();
    expect(result.current.data).toEqual(expect.arrayContaining([userFoo]));
  });
});
