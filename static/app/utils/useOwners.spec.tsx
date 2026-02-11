import {MemberFixture} from 'sentry-fixture/member';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {TeamFixture} from 'sentry-fixture/team';
import {UserFixture} from 'sentry-fixture/user';

import {renderHookWithProviders, waitFor} from 'sentry-test/reactTestingLibrary';

import MemberListStore from 'sentry/stores/memberListStore';
import OrganizationStore from 'sentry/stores/organizationStore';
import TeamStore from 'sentry/stores/teamStore';

import {useOwners} from './useOwners';

describe('useOwners', () => {
  const org = OrganizationFixture();
  const mockUsers = [UserFixture()];
  const mockTeams = [TeamFixture()];

  let teamsRequest: jest.Mock;
  let membersRequest: jest.Mock;

  beforeEach(() => {
    MemberListStore.init();
    MemberListStore.loadInitialData(mockUsers);
    TeamStore.init();
    TeamStore.loadInitialData(mockTeams);
    OrganizationStore.onUpdate(org, {replace: true});

    MockApiClient.clearMockResponses();
    MockApiClient.addMockResponse({
      url: `/organizations/org-slug/user-teams/`,
      body: [],
    });
    teamsRequest = MockApiClient.addMockResponse({
      url: `/organizations/org-slug/teams/`,
      body: [],
    });
    membersRequest = MockApiClient.addMockResponse({
      url: `/organizations/org-slug/members/`,
      body: [],
    });
  });

  it('includes members and teams', async () => {
    const {result} = renderHookWithProviders(useOwners, {
      initialProps: {},
    });

    await waitFor(() => !result.current.fetching);

    expect(result.current.members).toEqual(mockUsers);
    expect(result.current.teams).toEqual(mockTeams);
  });

  it('fetches users and memberrs', async () => {
    const members = [
      MemberFixture({
        user: UserFixture({id: '5'}),
      }),
    ];
    const teams = [TeamFixture({id: '4', slug: 'other-slug'})];

    teamsRequest = MockApiClient.addMockResponse({
      url: `/organizations/org-slug/teams/`,
      body: teams,
    });
    membersRequest = MockApiClient.addMockResponse({
      url: `/organizations/org-slug/members/`,
      body: members,
    });

    const {result} = renderHookWithProviders(useOwners, {
      initialProps: {currentValue: ['user:5', 'team:4']},
    });

    await waitFor(() => !result.current.fetching);

    expect(teamsRequest).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        query: {query: 'id:4'},
      })
    );
    expect(membersRequest).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        query: {query: 'user.id:5'},
      })
    );

    expect(result.current.members).toEqual([
      ...members.map(member => member.user),
      ...mockUsers,
    ]);
    expect(result.current.teams).toEqual([...teams, ...mockTeams]);
  });
});
