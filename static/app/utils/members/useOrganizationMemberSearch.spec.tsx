import {OrganizationFixture} from 'sentry-fixture/organization';
import {UserFixture} from 'sentry-fixture/user';

import {act, renderHookWithProviders, waitFor} from 'sentry-test/reactTestingLibrary';

import {useOrganizationMemberSearch} from 'sentry/utils/members/useOrganizationMemberSearch';

describe('useOrganizationMemberSearch', () => {
  const org = OrganizationFixture();
  const mockUsers = [UserFixture()];

  it('loads more members when searching', async () => {
    const newUser2 = UserFixture({id: '2', email: 'test-user2@example.com'});
    const newUser3 = UserFixture({id: '3', email: 'test-user3@example.com'});

    const initialRequest = MockApiClient.addMockResponse({
      url: `/organizations/${org.slug}/members/`,
      method: 'GET',
      body: [{user: mockUsers[0]}],
    });
    const searchRequest = MockApiClient.addMockResponse({
      url: `/organizations/${org.slug}/members/`,
      method: 'GET',
      body: [{user: mockUsers[0]}, {user: newUser2}, {user: newUser3}],
      match: [MockApiClient.matchQuery({query: 'test'})],
      asyncDelay: 100,
    });

    const {result} = renderHookWithProviders(useOrganizationMemberSearch, {
      organization: org,
    });
    await waitFor(() => expect(result.current.isFetched).toBe(true));
    const {onSearch} = result.current;

    await act(() => onSearch('test'));

    expect(result.current.isPending).toBe(false);

    await waitFor(() => expect(result.current.members).toHaveLength(3));
    expect(result.current.isPending).toBe(false);

    expect(initialRequest).toHaveBeenCalledTimes(1);
    expect(searchRequest).toHaveBeenCalled();
    expect(result.current.members).toEqual([...mockUsers, newUser2, newUser3]);

    searchRequest.mockClear();
    await act(() => onSearch('test'));

    expect(searchRequest).not.toHaveBeenCalled();
    expect(result.current.members).toEqual([...mockUsers, newUser2, newUser3]);
  });
});
