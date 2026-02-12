import {OrganizationFixture} from 'sentry-fixture/organization';
import {UserFixture} from 'sentry-fixture/user';

import {act, renderHook, waitFor} from 'sentry-test/reactTestingLibrary';

import MemberListStore from 'sentry/stores/memberListStore';
import OrganizationStore from 'sentry/stores/organizationStore';
import {useMembers} from 'sentry/utils/useMembers';

describe('useMembers', () => {
  const org = OrganizationFixture();

  const mockUsers = [UserFixture()];

  beforeEach(() => {
    MemberListStore.reset();
    OrganizationStore.onUpdate(org, {replace: true});
  });

  it('provides members from the MemberListStore', () => {
    MemberListStore.loadInitialData(mockUsers);

    const {result} = renderHook(useMembers);
    const {members} = result.current;

    expect(members).toEqual(mockUsers);
  });

  it('loads more members when using onSearch', async () => {
    MemberListStore.loadInitialData(mockUsers);
    const newUser2 = UserFixture({id: '2', email: 'test-user2@example.com'});
    const newUser3 = UserFixture({id: '3', email: 'test-user3@example.com'});

    const mockRequest = MockApiClient.addMockResponse({
      url: `/organizations/${org.slug}/members/`,
      method: 'GET',
      body: [{user: newUser2}, {user: newUser3}],
    });

    const {result} = renderHook(useMembers);
    const {onSearch} = result.current;

    // Works with append
    await act(() => onSearch('test'));
    expect(result.current.fetching).toBe(false);

    // Wait for state to be reflected from the store
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
    MemberListStore.loadInitialData(mockUsers);
    const userFoo = UserFixture({email: 'foo@test.com'});
    const mockRequest = MockApiClient.addMockResponse({
      url: `/organizations/${org.slug}/members/`,
      method: 'GET',
      body: [{user: userFoo}],
    });

    const {result} = renderHook(useMembers, {
      initialProps: {emails: ['foo@test.com']},
    });

    expect(result.current.initiallyLoaded).toBe(false);
    expect(mockRequest).toHaveBeenCalled();

    await waitFor(() => expect(result.current.members).toHaveLength(1));

    const {members} = result.current;
    expect(members).toEqual(expect.arrayContaining([userFoo]));
  });

  it('provides only the specified ids', async () => {
    MemberListStore.loadInitialData(mockUsers);
    const userFoo = UserFixture({id: '10'});
    const mockRequest = MockApiClient.addMockResponse({
      url: `/organizations/${org.slug}/members/`,
      method: 'GET',
      body: [{user: userFoo}],
    });

    const {result} = renderHook(useMembers, {
      initialProps: {ids: ['10']},
    });

    expect(result.current.initiallyLoaded).toBe(false);
    expect(mockRequest).toHaveBeenCalled();

    await waitFor(() => expect(result.current.members).toHaveLength(1));

    const {members} = result.current;
    expect(members).toEqual(expect.arrayContaining([userFoo]));
  });

  it('waits for the member store to finish loading before fetching by ids', async () => {
    const userFoo = UserFixture({id: '10'});
    const mockRequest = MockApiClient.addMockResponse({
      url: `/organizations/${org.slug}/members/`,
      method: 'GET',
      body: [{user: userFoo}],
    });

    const {result} = renderHook(useMembers, {
      initialProps: {ids: ['10']},
    });

    expect(result.current.initiallyLoaded).toBe(false);
    expect(mockRequest).not.toHaveBeenCalled();

    act(() => MemberListStore.loadInitialData([userFoo]));
    await waitFor(() => expect(result.current.members).toEqual([userFoo]));

    expect(result.current.initiallyLoaded).toBe(true);
    expect(mockRequest).not.toHaveBeenCalled();
  });

  it('only loads emails when needed', () => {
    MemberListStore.loadInitialData(mockUsers);

    const {result} = renderHook(useMembers, {
      initialProps: {emails: [mockUsers[0]!.email]},
    });

    const {members, initiallyLoaded} = result.current;
    expect(initiallyLoaded).toBe(true);
    expect(members).toEqual(expect.arrayContaining(mockUsers));
  });

  it('correctly returns hasMore before and after store update', async () => {
    const {result} = renderHook(useMembers);

    const {members, hasMore} = result.current;
    expect(hasMore).toBeNull();
    expect(members).toEqual(expect.arrayContaining([]));

    act(() => MemberListStore.loadInitialData(mockUsers, false, null));
    await waitFor(() => expect(result.current.members).toHaveLength(1));

    expect(result.current.hasMore).toBe(false);
  });
});
