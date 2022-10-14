import {reactHooks} from 'sentry-test/reactTestingLibrary';

import OrganizationStore from 'sentry/stores/organizationStore';
import TeamStore from 'sentry/stores/teamStore';
import useTeams from 'sentry/utils/useTeams';

describe('useTeams', function () {
  const org = TestStubs.Organization();

  const mockTeams = [TestStubs.Team()];

  beforeEach(function () {
    TeamStore.reset();
  });

  it('provides teams from the team store', function () {
    TeamStore.loadInitialData(mockTeams);

    const {result} = reactHooks.renderHook(useTeams);
    const {teams} = result.current;

    expect(teams).toEqual(mockTeams);
  });

  it('loads more teams when using onSearch', async function () {
    TeamStore.loadInitialData(mockTeams);
    OrganizationStore.onUpdate(org, {replace: true});
    const newTeam2 = TestStubs.Team({id: '2', slug: 'test-team2'});
    const newTeam3 = TestStubs.Team({id: '3', slug: 'test-team3'});

    const mockRequest = MockApiClient.addMockResponse({
      url: `/organizations/${org.slug}/teams/`,
      method: 'GET',
      body: [newTeam2, newTeam3],
    });

    const {result, waitFor} = reactHooks.renderHook(useTeams);
    const {onSearch} = result.current;

    // Works with append
    const onSearchPromise = reactHooks.act(() => onSearch('test'));

    expect(result.current.fetching).toBe(true);
    await onSearchPromise;
    expect(result.current.fetching).toBe(false);

    // Wait for state to be reflected from the store
    await waitFor(() => result.current.teams.length === 3);

    expect(mockRequest).toHaveBeenCalled();
    expect(result.current.teams).toEqual([...mockTeams, newTeam2, newTeam3]);

    // de-duplicates items in the query results
    mockRequest.mockClear();
    await reactHooks.act(() => onSearch('test'));

    // No new items have been added
    expect(mockRequest).toHaveBeenCalled();
    expect(result.current.teams).toEqual([...mockTeams, newTeam2, newTeam3]);
  });

  it('provides only the users teams', function () {
    const userTeams = [TestStubs.Team({id: '1', isMember: true})];
    const nonUserTeams = [TestStubs.Team({id: '2', isMember: false})];
    TeamStore.loadInitialData([...userTeams, ...nonUserTeams], false, null);

    const {result} = reactHooks.renderHook(useTeams, {
      initialProps: {provideUserTeams: true},
    });
    const {teams} = result.current;

    expect(teams.length).toBe(1);
    expect(teams).toEqual(expect.arrayContaining(userTeams));
  });

  it('provides only the specified slugs', async function () {
    TeamStore.loadInitialData(mockTeams);
    const teamFoo = TestStubs.Team({slug: 'foo'});
    const mockRequest = MockApiClient.addMockResponse({
      url: `/organizations/${org.slug}/teams/`,
      method: 'GET',
      body: [teamFoo],
    });

    const {result, waitFor} = reactHooks.renderHook(useTeams, {
      initialProps: {slugs: ['foo']},
    });

    expect(result.current.initiallyLoaded).toBe(false);
    expect(mockRequest).toHaveBeenCalled();

    await waitFor(() => expect(result.current.teams.length).toBe(1));

    const {teams} = result.current;
    expect(teams).toEqual(expect.arrayContaining([teamFoo]));
  });

  it('only loads slugs when needed', function () {
    TeamStore.loadInitialData(mockTeams);

    const {result} = reactHooks.renderHook(useTeams, {
      initialProps: {slugs: [mockTeams[0].slug]},
    });

    const {teams, initiallyLoaded} = result.current;
    expect(initiallyLoaded).toBe(true);
    expect(teams).toEqual(expect.arrayContaining(mockTeams));
  });

  it('can load teams by id', async function () {
    const requestedTeams = [TestStubs.Team({id: '2', slug: 'requested-team'})];
    const mockRequest = MockApiClient.addMockResponse({
      url: `/organizations/${org.slug}/teams/`,
      method: 'GET',
      body: requestedTeams,
    });

    TeamStore.loadInitialData(mockTeams);

    const {result, waitFor} = reactHooks.renderHook(useTeams, {
      initialProps: {ids: ['2']},
    });

    expect(result.current.initiallyLoaded).toBe(false);
    expect(mockRequest).toHaveBeenCalled();

    await waitFor(() => expect(result.current.teams.length).toBe(1));

    const {teams} = result.current;
    expect(teams).toEqual(expect.arrayContaining(requestedTeams));
  });

  it('only loads ids when needed', function () {
    TeamStore.loadInitialData(mockTeams);

    const {result} = reactHooks.renderHook(useTeams, {
      initialProps: {ids: [mockTeams[0].id]},
    });

    const {teams, initiallyLoaded} = result.current;
    expect(initiallyLoaded).toBe(true);
    expect(teams).toEqual(expect.arrayContaining(mockTeams));
  });

  it('correctly returns hasMore before and after store update', async function () {
    const {result, waitFor} = reactHooks.renderHook(useTeams);

    const {teams, hasMore} = result.current;
    expect(hasMore).toBe(null);
    expect(teams).toEqual(expect.arrayContaining([]));

    reactHooks.act(() => TeamStore.loadInitialData(mockTeams, false, null));
    await waitFor(() => expect(result.current.teams.length).toBe(1));

    expect(result.current.hasMore).toBe(false);
  });
});
