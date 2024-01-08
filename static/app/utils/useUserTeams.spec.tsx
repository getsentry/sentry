import {OrganizationFixture} from 'sentry-fixture/organization';
import {TeamFixture} from 'sentry-fixture/team';

import {reactHooks} from 'sentry-test/reactTestingLibrary';

import OrganizationStore from 'sentry/stores/organizationStore';
import TeamStore from 'sentry/stores/teamStore';
import {QueryClient, QueryClientProvider} from 'sentry/utils/queryClient';

import {useUserTeams} from './useUserTeams';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
    },
  },
});

describe('useUserTeams', () => {
  const org = OrganizationFixture();
  const wrapper = ({children}: {children?: any}) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );

  beforeEach(function () {
    TeamStore.reset();
    OrganizationStore.onUpdate(org, {replace: true});
    MockApiClient.clearMockResponses();
    queryClient.clear();
  });

  it('does not request user teams until the store has loaded', async function () {
    const userTeams = [TeamFixture({id: '1', isMember: true})];
    const nonUserTeams = [TeamFixture({id: '2', isMember: false})];
    const mockapi = MockApiClient.addMockResponse({
      url: `/organizations/org-slug/user-teams/`,
      body: userTeams,
    });

    const {result, waitFor} = reactHooks.renderHook(useUserTeams, {wrapper});
    const {teams} = result.current;
    expect(teams.length).toBe(0);

    expect(TeamStore.getState().loading).toBe(true);
    expect(mockapi).toHaveBeenCalledTimes(0);
    reactHooks.act(() => TeamStore.loadInitialData(nonUserTeams, true, null));
    expect(TeamStore.getState().loading).toBe(false);
    expect(TeamStore.getState().loadedUserTeams).toBe(false);

    await waitFor(() => result.current.teams.length === 1);
    expect(mockapi).toHaveBeenCalledTimes(1);
    expect(result.current.teams).toEqual(userTeams);
  });

  it('provides only the users teams', function () {
    const userTeams = [TeamFixture({id: '1', isMember: true})];
    const nonUserTeams = [TeamFixture({id: '2', isMember: false})];
    // User teams marked loaded because hasMore is false
    TeamStore.loadInitialData([...userTeams, ...nonUserTeams], false, null);
    expect(TeamStore.getState().loadedUserTeams).toBe(true);

    const {result} = reactHooks.renderHook(useUserTeams, {wrapper});
    const {teams} = result.current;

    expect(teams.length).toBe(1);
    expect(teams).toEqual(userTeams);
  });
});
