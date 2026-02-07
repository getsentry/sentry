import {OrganizationFixture} from 'sentry-fixture/organization';
import {TeamFixture} from 'sentry-fixture/team';

import {act, renderHookWithProviders, waitFor} from 'sentry-test/reactTestingLibrary';

import OrganizationStore from 'sentry/stores/organizationStore';
import TeamStore from 'sentry/stores/teamStore';
import {isActiveSuperuser} from 'sentry/utils/isActiveSuperuser';

import {useUserTeams} from './useUserTeams';

jest.mock('sentry/utils/isActiveSuperuser', () => ({
  isActiveSuperuser: jest.fn(),
}));

describe('useUserTeams', () => {
  const org = OrganizationFixture({
    access: [],
  });

  beforeEach(() => {
    TeamStore.reset();
    OrganizationStore.onUpdate(org, {replace: true});
    MockApiClient.clearMockResponses();
  });

  it('does not request user teams until the store has loaded', async () => {
    const userTeams = [TeamFixture({id: '1', isMember: true})];
    const nonUserTeams = [TeamFixture({id: '2', isMember: false})];
    const mockapi = MockApiClient.addMockResponse({
      url: `/organizations/org-slug/user-teams/`,
      body: userTeams,
    });

    const {result} = renderHookWithProviders(useUserTeams, {organization: org});
    const {teams} = result.current;
    expect(teams).toHaveLength(0);

    expect(TeamStore.getState().loading).toBe(true);
    expect(mockapi).toHaveBeenCalledTimes(0);
    act(() => TeamStore.loadInitialData(nonUserTeams, true, null));
    expect(TeamStore.getState().loading).toBe(false);
    expect(TeamStore.getState().loadedUserTeams).toBe(false);

    await waitFor(() => result.current.teams.length === 1);
    expect(mockapi).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(result.current.teams).toEqual(userTeams));
  });

  it('provides only the users teams', () => {
    const userTeams = [TeamFixture({id: '1', isMember: true})];
    const nonUserTeams = [TeamFixture({id: '2', isMember: false})];
    // User teams marked loaded because hasMore is false
    TeamStore.loadInitialData([...userTeams, ...nonUserTeams], false, null);
    expect(TeamStore.getState().loadedUserTeams).toBe(true);

    const {result} = renderHookWithProviders(useUserTeams, {organization: org});
    const {teams} = result.current;

    expect(teams).toHaveLength(1);
    expect(teams).toEqual(userTeams);
  });

  it('superuser loads all teams', () => {
    jest.mocked(isActiveSuperuser).mockReturnValue(true);

    const userTeams = [TeamFixture({id: '1', isMember: true})];
    const nonUserTeams = [TeamFixture({id: '2', isMember: false})];
    // User teams marked loaded because hasMore is false
    TeamStore.loadInitialData([...userTeams, ...nonUserTeams], false, null);
    expect(TeamStore.getState().loadedUserTeams).toBe(true);

    const {result} = renderHookWithProviders(useUserTeams, {organization: org});
    const {teams} = result.current;

    expect(teams).toHaveLength(2);
    expect(teams).toEqual(userTeams.concat(nonUserTeams));
  });

  it('org owner loads all teams', () => {
    const userTeams = [TeamFixture({id: '1', isMember: true})];
    const nonUserTeams = [TeamFixture({id: '2', isMember: false})];
    // User teams marked loaded because hasMore is false
    TeamStore.loadInitialData([...userTeams, ...nonUserTeams], false, null);
    expect(TeamStore.getState().loadedUserTeams).toBe(true);

    const organization = OrganizationFixture({
      access: ['org:admin'],
    });
    OrganizationStore.onUpdate(organization, {replace: true});

    const {result} = renderHookWithProviders(useUserTeams, {organization: org});
    const {teams} = result.current;

    expect(teams).toHaveLength(2);
    expect(teams).toEqual(userTeams.concat(nonUserTeams));
  });
});
