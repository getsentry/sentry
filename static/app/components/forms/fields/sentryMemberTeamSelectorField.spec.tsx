import {OrganizationFixture} from 'sentry-fixture/organization';
import {TeamFixture} from 'sentry-fixture/team';
import {UserFixture} from 'sentry-fixture/user';

import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';
import selectEvent from 'sentry-test/selectEvent';

import MemberListStore from 'sentry/stores/memberListStore';
import OrganizationStore from 'sentry/stores/organizationStore';
import TeamStore from 'sentry/stores/teamStore';

import SentryMemberTeamSelectorField from './sentryMemberTeamSelectorField';

describe('SentryMemberTeamSelectorField', () => {
  const org = OrganizationFixture();
  const mockUsers = [UserFixture()];
  const mockTeams = [TeamFixture()];

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

  it('can select a team', async () => {
    const mock = jest.fn();
    render(
      <SentryMemberTeamSelectorField
        label="Select Owner"
        onChange={mock}
        name="team-or-member"
      />
    );

    await selectEvent.select(
      screen.getByRole('textbox', {name: 'Select Owner'}),
      `#${mockTeams[0].slug}`
    );

    expect(mock).toHaveBeenCalledWith('team:1', expect.anything());

    await userEvent.click(screen.getByLabelText('Clear choices'));
    expect(mock).toHaveBeenCalledWith(null, expect.anything());
  });

  it('can select a member', async () => {
    const mock = jest.fn();
    render(
      <SentryMemberTeamSelectorField
        label="Select Owner"
        onChange={mock}
        name="team-or-member"
      />
    );

    await selectEvent.select(
      screen.getByRole('textbox', {name: 'Select Owner'}),
      mockUsers[0].name
    );

    expect(mock).toHaveBeenCalledWith('user:1', expect.anything());

    await userEvent.click(screen.getByLabelText('Clear choices'));
    expect(mock).toHaveBeenCalledWith(null, expect.anything());
  });

  it('can multiselect a member', async () => {
    const mock = jest.fn();
    render(
      <SentryMemberTeamSelectorField
        label="Select Owner"
        onChange={mock}
        name="team-or-member"
        multiple
      />
    );

    await selectEvent.select(
      screen.getByRole('textbox', {name: 'Select Owner'}),
      mockUsers[0].name
    );
    await selectEvent.select(
      screen.getByRole('textbox', {name: 'Select Owner'}),
      `#${mockTeams[0].slug}`
    );

    expect(mock).toHaveBeenCalledWith(['user:1', 'team:1'], expect.anything());

    await userEvent.click(screen.getByLabelText('Clear choices'));
    expect(mock).toHaveBeenCalledWith([], expect.anything());
  });
});
