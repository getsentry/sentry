import {act, renderHook} from '@testing-library/react-hooks';

import OrganizationStore from 'app/stores/organizationStore';
import TeamStore from 'app/stores/teamStore';
import useTeams from 'app/utils/useTeams';

describe('useTeams', function () {
  // @ts-expect-error
  const org = TestStubs.Organization();

  // @ts-expect-error
  const mockTeams = [TestStubs.Team()];

  it('provides teams from the team store', function () {
    act(() => void TeamStore.loadInitialData(mockTeams));

    const {result} = renderHook(() => useTeams());
    const {teams} = result.current;

    expect(teams).toBe(mockTeams);
  });

  it('loads more teams when using onSearch', async function () {
    act(() => void TeamStore.loadInitialData(mockTeams));
    act(() => void OrganizationStore.onUpdate(org, {replace: true}));

    // @ts-expect-error
    const newTeam2 = TestStubs.Team({id: '2', slug: 'test-team2'});
    // @ts-expect-error
    const newTeam3 = TestStubs.Team({id: '3', slug: 'test-team3'});

    // @ts-expect-error
    const mockRequest = MockApiClient.addMockResponse({
      url: `/organizations/${org.slug}/teams/`,
      method: 'GET',
      query: {query: 'test'},
      body: [newTeam2, newTeam3],
    });

    const {result, waitFor} = renderHook(() => useTeams());
    const {onSearch} = result.current;

    // Works with append
    const onSearchPromise = act(() => onSearch('test'));

    expect(result.current.fetching).toBe(true);
    await onSearchPromise;
    expect(result.current.fetching).toBe(false);

    // Wait for state to be reflected from the store
    await waitFor(() => result.current.teams.length === 3);

    expect(mockRequest).toHaveBeenCalled();
    expect(result.current.teams).toEqual([...mockTeams, newTeam2, newTeam3]);

    // de-duplicates itesm in the query results
    mockRequest.mockClear();
    await act(() => onSearch('test'));

    // No new items have been added
    expect(mockRequest).toHaveBeenCalled();
    expect(result.current.teams).toEqual([...mockTeams, newTeam2, newTeam3]);
  });
});
