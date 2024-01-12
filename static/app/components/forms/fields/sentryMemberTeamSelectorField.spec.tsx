import selectEvent from 'react-select-event';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {ProjectFixture} from 'sentry-fixture/project';
import {TeamFixture} from 'sentry-fixture/team';
import {UserFixture} from 'sentry-fixture/user';

import {render, screen} from 'sentry-test/reactTestingLibrary';

import MemberListStore from 'sentry/stores/memberListStore';
import OrganizationStore from 'sentry/stores/organizationStore';
import TeamStore from 'sentry/stores/teamStore';

import SentryMemberTeamSelectorField from './sentryMemberTeamSelectorField';

describe('SentryMemberTeamSelectorField', () => {
  const org = OrganizationFixture();
  const mockUsers = [UserFixture()];
  const mockTeams = [TeamFixture()];
  const mockProjects = [ProjectFixture()];

  beforeEach(() => {
    MemberListStore.init();
    MemberListStore.loadInitialData(mockUsers);
    TeamStore.init();
    TeamStore.loadInitialData(mockTeams);
    OrganizationStore.onUpdate(org, {replace: true});

    MockApiClient.addMockResponse({
      url: `/organizations/org-slug/user-teams/`,
      body: [],
    });
    MockApiClient.addMockResponse({
      url: `/organizations/org-slug/teams/`,
      body: [],
    });
    MockApiClient.addMockResponse({
      url: `/organizations/org-slug/members/`,
      body: [],
    });
  });

  it('can change values', async () => {
    const mock = jest.fn();
    render(
      <SentryMemberTeamSelectorField
        onChange={mock}
        name="team-or-member"
        projects={mockProjects}
      />
    );

    await selectEvent.select(screen.getByText(/Choose Teams and Members/i), '#team-slug');

    expect(mock).toHaveBeenCalledWith('team:1', expect.anything());
  });
});
