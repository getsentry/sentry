import {Organization} from 'sentry-fixture/organization';
import {User} from 'sentry-fixture/user';

import {reactHooks} from 'sentry-test/reactTestingLibrary';

import MemberListStore from 'sentry/stores/memberListStore';
import OrganizationStore from 'sentry/stores/organizationStore';
import {useMembers} from 'sentry/utils/useMembers';

describe('useMembers', function () {
  const org = Organization();

  const mockUsers = [User()];

  beforeEach(function () {
    MemberListStore.reset();
    OrganizationStore.onUpdate(org, {replace: true});
  });

  it('provides members from the MemberListStore', function () {
    MemberListStore.loadInitialData(mockUsers);

    const {result} = reactHooks.renderHook(useMembers);
    const {members} = result.current;

    expect(members).toEqual(mockUsers);
  });

  it('loads more members when using onSearch', async function () {
    MemberListStore.loadInitialData(mockUsers);
    const newUser2 = User({id: '2', email: 'test-user2@example.com'});
    const newUser3 = User({id: '3', email: 'test-user3@example.com'});

    const mockRequest = MockApiClient.addMockResponse({
      url: `/organizations/${org.slug}/members/`,
      method: 'GET',
      body: [{user: newUser2}, {user: newUser3}],
    });

    const {result, waitFor} = reactHooks.renderHook(useMembers);
    const {onSearch} = result.current;

    // Works with append
    const onSearchPromise = reactHooks.act(() => onSearch('test'));

    expect(result.current.fetching).toBe(true);
    await onSearchPromise;
    expect(result.current.fetching).toBe(false);

    // Wait for state to be reflected from the store
    await waitFor(() => result.current.members.length === 3);

    expect(mockRequest).toHaveBeenCalled();
    expect(result.current.members).toEqual([...mockUsers, newUser2, newUser3]);

    // de-duplicates items in the query results
    mockRequest.mockClear();
    await reactHooks.act(() => onSearch('test'));

    // No new items have been added
    expect(mockRequest).toHaveBeenCalled();
    expect(result.current.members).toEqual([...mockUsers, newUser2, newUser3]);
  });

  it('provides only the specified emails', async function () {
    MemberListStore.loadInitialData(mockUsers);
    const userFoo = User({email: 'foo@test.com'});
    const mockRequest = MockApiClient.addMockResponse({
      url: `/organizations/${org.slug}/members/`,
      method: 'GET',
      body: [{user: userFoo}],
    });

    const {result, waitFor} = reactHooks.renderHook(useMembers, {
      initialProps: {emails: ['foo@test.com']},
    });

    expect(result.current.initiallyLoaded).toBe(false);
    expect(mockRequest).toHaveBeenCalled();

    await waitFor(() => expect(result.current.members.length).toBe(1));

    const {members} = result.current;
    expect(members).toEqual(expect.arrayContaining([userFoo]));
  });

  it('provides only the specified ids', async function () {
    MemberListStore.loadInitialData(mockUsers);
    const userFoo = User({id: '10'});
    const mockRequest = MockApiClient.addMockResponse({
      url: `/organizations/${org.slug}/members/`,
      method: 'GET',
      body: [{user: userFoo}],
    });

    const {result, waitFor} = reactHooks.renderHook(useMembers, {
      initialProps: {ids: ['10']},
    });

    expect(result.current.initiallyLoaded).toBe(false);
    expect(mockRequest).toHaveBeenCalled();

    await waitFor(() => expect(result.current.members.length).toBe(1));

    const {members} = result.current;
    expect(members).toEqual(expect.arrayContaining([userFoo]));
  });

  it('only loads emails when needed', function () {
    MemberListStore.loadInitialData(mockUsers);

    const {result} = reactHooks.renderHook(useMembers, {
      initialProps: {emails: [mockUsers[0].email]},
    });

    const {members, initiallyLoaded} = result.current;
    expect(initiallyLoaded).toBe(true);
    expect(members).toEqual(expect.arrayContaining(mockUsers));
  });

  it('correctly returns hasMore before and after store update', async function () {
    const {result, waitFor} = reactHooks.renderHook(useMembers);

    const {members, hasMore} = result.current;
    expect(hasMore).toBe(null);
    expect(members).toEqual(expect.arrayContaining([]));

    reactHooks.act(() => MemberListStore.loadInitialData(mockUsers, false, null));
    await waitFor(() => expect(result.current.members.length).toBe(1));

    expect(result.current.hasMore).toBe(false);
  });
});
