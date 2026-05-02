import {OrganizationFixture} from 'sentry-fixture/organization';
import {UserFixture} from 'sentry-fixture/user';

import {act, renderHookWithProviders, waitFor} from 'sentry-test/reactTestingLibrary';

import {useMembers} from 'sentry/utils/useMembers';

describe('useMembers', () => {
  const org = OrganizationFixture();

  const mockUsers = [UserFixture()];

  const renderUseMembers = (props?: Parameters<typeof useMembers>[0]) =>
    renderHookWithProviders(useMembers, {initialProps: props, organization: org});

  it('provides members from the members endpoint', async () => {
    const mockRequest = MockApiClient.addMockResponse({
      url: `/organizations/${org.slug}/members/`,
      method: 'GET',
      body: mockUsers.map(user => ({user})),
    });

    const {result} = renderUseMembers();

    await waitFor(() => expect(result.current.initiallyLoaded).toBe(true));

    expect(mockRequest).toHaveBeenCalled();
    expect(result.current.members).toEqual(mockUsers);
  });

  it('loads more members when using onSearch', async () => {
    const newUser2 = UserFixture({id: '2', email: 'test-user2@example.com'});
    const newUser3 = UserFixture({id: '3', email: 'test-user3@example.com'});

    const mockRequest = MockApiClient.addMockResponse({
      url: `/organizations/${org.slug}/members/`,
      method: 'GET',
      body: [{user: mockUsers[0]}, {user: newUser2}, {user: newUser3}],
    });

    const {result} = renderUseMembers();
    const {onSearch} = result.current;

    // Works with append
    await act(() => onSearch('test'));
    expect(result.current.fetching).toBe(false);

    await waitFor(() => result.current.members.length === 3);

    expect(mockRequest).toHaveBeenCalled();
    expect(result.current.members).toEqual([...mockUsers, newUser2, newUser3]);

    // de-duplicates items in the query results
    mockRequest.mockClear();
    await act(() => onSearch('test'));

    // No new items have been added
    expect(mockRequest).toHaveBeenCalled();
    expect(result.current.members).toEqual([...mockUsers, newUser2, newUser3]);
  });

  it('provides only the specified emails', async () => {
    const userFoo = UserFixture({email: 'foo@test.com'});
    const mockRequest = MockApiClient.addMockResponse({
      url: `/organizations/${org.slug}/members/`,
      method: 'GET',
      body: [{user: userFoo}],
    });

    const {result} = renderUseMembers({emails: ['foo@test.com']});

    expect(result.current.initiallyLoaded).toBe(false);
    expect(mockRequest).toHaveBeenCalled();

    await waitFor(() => expect(result.current.members).toHaveLength(1));

    const {members} = result.current;
    expect(members).toEqual(expect.arrayContaining([userFoo]));
  });

  it('provides only the specified ids', async () => {
    const userFoo = UserFixture({id: '10'});
    const mockRequest = MockApiClient.addMockResponse({
      url: `/organizations/${org.slug}/members/`,
      method: 'GET',
      body: [{user: userFoo}],
    });

    const {result} = renderUseMembers({ids: ['10']});

    expect(result.current.initiallyLoaded).toBe(false);
    expect(mockRequest).toHaveBeenCalled();

    await waitFor(() => expect(result.current.members).toHaveLength(1));

    const {members} = result.current;
    expect(members).toEqual(expect.arrayContaining([userFoo]));
  });

  it('tracks requested ids that failed to load', async () => {
    const mockRequest = MockApiClient.addMockResponse({
      url: `/organizations/${org.slug}/members/`,
      method: 'GET',
      body: [],
    });

    const {result} = renderUseMembers({ids: ['10']});

    expect(result.current.initiallyLoaded).toBe(false);

    await waitFor(() => expect(result.current.initiallyLoaded).toBe(true));

    expect(mockRequest).toHaveBeenCalledTimes(1);
    expect(result.current.members).toEqual([]);

    mockRequest.mockClear();
    await act(() => result.current.loadMore());

    expect(result.current.members).toEqual([]);
    expect(mockRequest).toHaveBeenCalledTimes(1);
  });

  it('only provides emails that were requested', async () => {
    const requestedUser = UserFixture({email: mockUsers[0]!.email});
    const otherUser = UserFixture({email: 'other@test.com'});
    const mockRequest = MockApiClient.addMockResponse({
      url: `/organizations/${org.slug}/members/`,
      method: 'GET',
      body: [{user: requestedUser}, {user: otherUser}],
    });

    const {result} = renderUseMembers({emails: [mockUsers[0]!.email]});

    await waitFor(() => expect(result.current.initiallyLoaded).toBe(true));

    const {members, initiallyLoaded} = result.current;
    expect(mockRequest).toHaveBeenCalled();
    expect(initiallyLoaded).toBe(true);
    expect(members).toEqual([requestedUser]);
  });

  it('correctly returns hasMore before and after store update', async () => {
    MockApiClient.addMockResponse({
      url: `/organizations/${org.slug}/members/`,
      method: 'GET',
      body: mockUsers.map(user => ({user})),
    });

    const {result} = renderUseMembers();

    const {members, hasMore} = result.current;
    expect(hasMore).toBeNull();
    expect(members).toEqual(expect.arrayContaining([]));

    await waitFor(() => expect(result.current.members).toHaveLength(1));

    expect(result.current.hasMore).toBe(false);
  });
});
