import {OrganizationFixture} from 'sentry-fixture/organization';
import {TeamFixture} from 'sentry-fixture/team';

import {renderHook, waitFor} from 'sentry-test/reactTestingLibrary';

import OrganizationStore from 'sentry/stores/organizationStore';
import TeamStore from 'sentry/stores/teamStore';
import {QueryClient, QueryClientProvider} from 'sentry/utils/queryClient';
import {OrganizationContext} from 'sentry/views/organizationContext';

import {useTeamsById as useTeamsById} from './useTeamsById';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
    },
  },
});

describe('useTeamsById', function () {
  const org = OrganizationFixture();
  const mockTeams = [TeamFixture()];

  const wrapper = ({children}: {children?: any}) => (
    <OrganizationContext.Provider value={org}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </OrganizationContext.Provider>
  );

  beforeEach(function () {
    TeamStore.reset();
    OrganizationStore.onUpdate(org, {replace: true});
    queryClient.clear();
  });

  it('provides teams from the team store', function () {
    TeamStore.loadInitialData(mockTeams);

    const {result} = renderHook(useTeamsById, {wrapper});
    const {teams} = result.current;

    expect(teams).toEqual(mockTeams);
  });

  it('waits for the teamstore to load', function () {
    const mockRequest = MockApiClient.addMockResponse({
      url: `/organizations/${org.slug}/teams/`,
      method: 'GET',
      body: mockTeams,
    });
    // TeamStore.loadInitialData not yet called
    expect(TeamStore.getState().loading).toBe(true);
    const {result} = renderHook(useTeamsById, {
      initialProps: {slugs: ['foo']},
      wrapper,
    });
    const {isLoading} = result.current;
    expect(isLoading).toBe(true);
    expect(mockRequest).not.toHaveBeenCalled();
  });

  it('provides only the specified slugs', async function () {
    TeamStore.loadInitialData(mockTeams);
    const teamFoo = TeamFixture({id: '49', slug: 'foo'});
    const mockRequest = MockApiClient.addMockResponse({
      url: `/organizations/${org.slug}/teams/`,
      method: 'GET',
      body: [teamFoo],
    });

    const {result} = renderHook(useTeamsById, {
      initialProps: {slugs: ['foo']},
      wrapper,
    });

    expect(result.current.isLoading).toBe(true);
    expect(mockRequest).toHaveBeenCalled();

    await waitFor(() => {
      expect(result.current.teams).toHaveLength(1);
    });

    const {teams} = result.current;
    expect(teams).toEqual(expect.arrayContaining([teamFoo]));
    expect(TeamStore.getState().teams).toEqual(expect.arrayContaining([teamFoo]));
  });

  it('only loads slugs when needed', function () {
    TeamStore.loadInitialData(mockTeams);

    const {result} = renderHook(useTeamsById, {
      initialProps: {slugs: [mockTeams[0]!.slug]},
      wrapper,
    });

    const {teams, isLoading} = result.current;
    expect(isLoading).toBe(false);
    expect(teams).toEqual(expect.arrayContaining(mockTeams));
  });

  it('can load team by id', async function () {
    const requestedTeams = [TeamFixture({id: '2', slug: 'requested-team'})];
    const mockRequest = MockApiClient.addMockResponse({
      url: `/organizations/${org.slug}/teams/`,
      method: 'GET',
      body: requestedTeams,
    });

    TeamStore.loadInitialData(mockTeams);

    const {result} = renderHook(useTeamsById, {
      initialProps: {ids: ['2']},
      wrapper,
    });

    expect(result.current.isLoading).toBe(true);
    expect(mockRequest).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({query: {query: 'id:2'}})
    );

    await waitFor(() => expect(result.current.teams).toHaveLength(1));

    const {teams} = result.current;
    expect(teams).toEqual(expect.arrayContaining(requestedTeams));
    expect(TeamStore.getState().teams).toEqual(expect.arrayContaining(requestedTeams));
  });

  it('can load multiple teams by id', async function () {
    const requestedTeams = [
      TeamFixture({id: '2', slug: 'requested-team'}),
      TeamFixture({id: '3', slug: 'requested-team-2'}),
    ];
    const mockRequest = MockApiClient.addMockResponse({
      url: `/organizations/${org.slug}/teams/`,
      method: 'GET',
      body: requestedTeams,
    });

    TeamStore.loadInitialData(mockTeams);

    const {result} = renderHook(useTeamsById, {
      initialProps: {ids: ['2', '3']},
      wrapper,
    });

    expect(result.current.isLoading).toBe(true);
    expect(mockRequest).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({query: {query: 'id:2 id:3'}})
    );

    await waitFor(() => expect(result.current.teams).toHaveLength(2));

    const {teams} = result.current;
    expect(teams).toEqual(expect.arrayContaining(requestedTeams));
    expect(TeamStore.getState().teams).toEqual(expect.arrayContaining(requestedTeams));
  });

  it('does not fetch anything if the teams are already loaded', function () {
    TeamStore.loadInitialData(mockTeams);

    const {result} = renderHook(useTeamsById, {
      initialProps: {ids: ['1']},
      wrapper,
    });

    const {teams, isLoading} = result.current;
    expect(isLoading).toBe(false);
    expect(teams).toEqual(expect.arrayContaining(mockTeams));
  });

  it('only loads ids when needed', async function () {
    const mockTeamsToFetch = [
      TeamFixture({id: '1', slug: 'requested-team-1'}),
      TeamFixture({id: '2', slug: 'requested-team-2'}),
    ];

    const mockRequest = MockApiClient.addMockResponse({
      url: `/organizations/${org.slug}/teams/`,
      method: 'GET',
      match: [MockApiClient.matchQuery({query: 'id:2'})],
      body: [mockTeamsToFetch[1]],
    });

    // Team 1 is already loaded
    TeamStore.loadInitialData([mockTeamsToFetch[0]!]);

    // Request teams 1 and 2
    const {result} = renderHook(useTeamsById, {
      initialProps: {ids: ['1', '2']},
      wrapper,
    });

    // Should return both teams
    await waitFor(() => expect(result.current.teams).toEqual(mockTeamsToFetch));

    // Should only have fetched team 2
    expect(mockRequest).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({query: {query: 'id:2'}})
    );
  });
});
