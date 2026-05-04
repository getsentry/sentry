import {OrganizationFixture} from 'sentry-fixture/organization';
import {UserFixture} from 'sentry-fixture/user';

import {
  act,
  render,
  renderHookWithProviders,
  screen,
  waitFor,
} from 'sentry-test/reactTestingLibrary';

import {useMembers} from 'sentry/utils/members/useMembers';
import {useOrganizationMemberSearch} from 'sentry/utils/members/useOrganizationMemberSearch';
import {useOrganizationMemberUsers} from 'sentry/utils/members/useOrganizationMemberUsers';

describe('useMembers', () => {
  const org = OrganizationFixture();

  const mockUsers = [UserFixture()];

  const renderUseMembers = (props: Parameters<typeof useMembers>[0]) =>
    renderHookWithProviders(useMembers, {initialProps: props, organization: org});

  function MultipleOrganizationMemberUsers() {
    const first = useOrganizationMemberUsers();
    const second = useOrganizationMemberUsers();

    return (
      <div data-test-id="load-state">
        {String(first.isSuccess)}:{String(second.isSuccess)}:{first.data?.length ?? 0}:
        {second.data?.length ?? 0}
      </div>
    );
  }

  it('provides organization member users from the members endpoint', async () => {
    const mockRequest = MockApiClient.addMockResponse({
      url: `/organizations/${org.slug}/members/`,
      method: 'GET',
      body: mockUsers.map(user => ({user})),
    });

    const {result} = renderHookWithProviders(useOrganizationMemberUsers, {
      organization: org,
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockRequest).toHaveBeenCalled();
    expect(result.current.data).toEqual(mockUsers);
  });

  it('shares the default members request across default hook instances', async () => {
    const mockRequest = MockApiClient.addMockResponse({
      url: `/organizations/${org.slug}/members/`,
      method: 'GET',
      body: mockUsers.map(user => ({user})),
    });

    render(<MultipleOrganizationMemberUsers />, {organization: org});

    await waitFor(() =>
      expect(screen.getByTestId('load-state')).toHaveTextContent('true:true:1:1')
    );

    expect(mockRequest).toHaveBeenCalledTimes(1);
  });

  it('loads more members when using organization member search', async () => {
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

    // Works with append
    await act(() => onSearch('test'));

    expect(result.current.isPending).toBe(false);

    await waitFor(() => expect(result.current.members).toHaveLength(3));
    expect(result.current.isPending).toBe(false);

    expect(initialRequest).toHaveBeenCalledTimes(1);
    expect(searchRequest).toHaveBeenCalled();
    expect(result.current.members).toEqual([...mockUsers, newUser2, newUser3]);

    // De-duplicates cached query results.
    searchRequest.mockClear();
    await act(() => onSearch('test'));

    // No new items have been added
    expect(searchRequest).not.toHaveBeenCalled();
    expect(result.current.members).toEqual([...mockUsers, newUser2, newUser3]);
  });

  it('requires filters and does not request members for empty filters', () => {
    const mockRequest = MockApiClient.addMockResponse({
      url: `/organizations/${org.slug}/members/`,
      method: 'GET',
      body: mockUsers.map(user => ({user})),
    });

    const {result} = renderUseMembers({ids: []});

    expect(result.current.isFetched).toBe(true);
    expect(result.current.isPending).toBe(false);
    expect(result.current.members).toEqual([]);
    expect(mockRequest).not.toHaveBeenCalled();
  });

  it('provides only the specified emails', async () => {
    const userFoo = UserFixture({email: 'foo@test.com'});
    const mockRequest = MockApiClient.addMockResponse({
      url: `/organizations/${org.slug}/members/`,
      method: 'GET',
      body: [{user: userFoo}],
    });

    const {result} = renderUseMembers({emails: ['foo@test.com']});

    expect(result.current.isFetched).toBe(false);

    await waitFor(() => expect(result.current.members).toHaveLength(1));

    expect(mockRequest).toHaveBeenCalled();
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

    expect(result.current.isFetched).toBe(false);

    await waitFor(() => expect(result.current.members).toHaveLength(1));

    expect(mockRequest).toHaveBeenCalled();
    const {members} = result.current;
    expect(members).toEqual(expect.arrayContaining([userFoo]));
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

    await waitFor(() => expect(result.current.isFetched).toBe(true));

    const {members, isFetched} = result.current;
    expect(mockRequest).toHaveBeenCalled();
    expect(isFetched).toBe(true);
    expect(members).toEqual([requestedUser]);
  });
});
