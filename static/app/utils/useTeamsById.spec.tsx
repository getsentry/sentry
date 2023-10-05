import {Organization} from 'sentry-fixture/organization';
import {Team} from 'sentry-fixture/team';

import {reactHooks} from 'sentry-test/reactTestingLibrary';

import OrganizationStore from 'sentry/stores/organizationStore';
import TeamStore from 'sentry/stores/teamStore';
import {QueryClient, QueryClientProvider} from 'sentry/utils/queryClient';

import {useTeamsById as useTeamsById} from './useTeamsById';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
    },
  },
});

describe('useTeamsById', function () {
  const org = Organization();
  const mockTeams = [Team()];

  const wrapper = ({children}: {children?: any}) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );

  beforeEach(function () {
    TeamStore.reset();
    OrganizationStore.onUpdate(org, {replace: true});
    queryClient.clear();
  });

  it('provides teams from the team store', function () {
    TeamStore.loadInitialData(mockTeams);

    const {result} = reactHooks.renderHook(useTeamsById, {wrapper});
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
    const {result} = reactHooks.renderHook(useTeamsById, {
      initialProps: {slugs: ['foo']},
      wrapper,
    });
    const {isLoading} = result.current;
    expect(isLoading).toBe(true);
    expect(mockRequest).not.toHaveBeenCalled();
  });

  it('provides only the specified slugs', async function () {
    TeamStore.loadInitialData(mockTeams);
    const teamFoo = Team({id: '49', slug: 'foo'});
    const mockRequest = MockApiClient.addMockResponse({
      url: `/organizations/${org.slug}/teams/`,
      method: 'GET',
      body: [teamFoo],
    });

    const {result, waitFor} = reactHooks.renderHook(useTeamsById, {
      initialProps: {slugs: ['foo']},
      wrapper,
    });

    expect(result.current.isLoading).toBe(true);
    expect(mockRequest).toHaveBeenCalled();

    await waitFor(() => {
      expect(result.current.teams.length).toBe(1);
    });

    const {teams} = result.current;
    expect(teams).toEqual(expect.arrayContaining([teamFoo]));
    expect(TeamStore.getState().teams).toEqual(expect.arrayContaining([teamFoo]));
  });

  it('only loads slugs when needed', function () {
    TeamStore.loadInitialData(mockTeams);

    const {result} = reactHooks.renderHook(useTeamsById, {
      initialProps: {slugs: [mockTeams[0].slug]},
      wrapper,
    });

    const {teams, isLoading} = result.current;
    expect(isLoading).toBe(false);
    expect(teams).toEqual(expect.arrayContaining(mockTeams));
  });

  it('can load teams by id', async function () {
    const requestedTeams = [Team({id: '2', slug: 'requested-team'})];
    const mockRequest = MockApiClient.addMockResponse({
      url: `/organizations/${org.slug}/teams/`,
      method: 'GET',
      body: requestedTeams,
    });

    TeamStore.loadInitialData(mockTeams);

    const {result, waitFor} = reactHooks.renderHook(useTeamsById, {
      initialProps: {ids: ['2']},
      wrapper,
    });

    expect(result.current.isLoading).toBe(true);
    expect(mockRequest).toHaveBeenCalled();

    await waitFor(() => expect(result.current.teams.length).toBe(1));

    const {teams} = result.current;
    expect(teams).toEqual(expect.arrayContaining(requestedTeams));
    expect(TeamStore.getState().teams).toEqual(expect.arrayContaining(requestedTeams));
  });

  it('only loads ids when needed', function () {
    TeamStore.loadInitialData(mockTeams);

    const {result} = reactHooks.renderHook(useTeamsById, {
      initialProps: {ids: [mockTeams[0].id]},
      wrapper,
    });

    const {teams, isLoading} = result.current;
    expect(isLoading).toBe(false);
    expect(teams).toEqual(expect.arrayContaining(mockTeams));
  });
});
