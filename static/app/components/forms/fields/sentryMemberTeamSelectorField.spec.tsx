import {OrganizationFixture} from 'sentry-fixture/organization';
import {ProjectFixture} from 'sentry-fixture/project';
import {TeamFixture} from 'sentry-fixture/team';
import {UserFixture} from 'sentry-fixture/user';

import {render, screen, userEvent, within} from 'sentry-test/reactTestingLibrary';
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
      `#${mockTeams[0]!.slug}`
    );

    expect(mock).toHaveBeenCalledWith('team:1', expect.anything());

    await userEvent.click(screen.getByLabelText('Clear choices'));
    expect(mock).toHaveBeenCalledWith(null, expect.anything());
  });

  it('separates my teams and other teams', async () => {
    TeamStore.init();
    TeamStore.loadInitialData([
      TeamFixture(),
      TeamFixture({id: '2', slug: 'other-team', isMember: false}),
    ]);

    const mock = jest.fn();
    render(
      <SentryMemberTeamSelectorField
        label="Select Owner"
        onChange={mock}
        name="team-or-member"
      />
    );

    await selectEvent.openMenu(screen.getByRole('textbox', {name: 'Select Owner'}));
    expect(await screen.findByText('My Teams')).toBeInTheDocument();
    expect(await screen.findByText('Other Teams')).toBeInTheDocument();
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
      mockUsers[0]!.name
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
      mockUsers[0]!.name
    );
    await selectEvent.select(
      screen.getByRole('textbox', {name: 'Select Owner'}),
      `#${mockTeams[0]!.slug}`
    );

    expect(mock).toHaveBeenCalledWith(['user:1', 'team:1'], expect.anything());

    await userEvent.click(screen.getByLabelText('Clear choices'));
    expect(mock).toHaveBeenCalledWith([], expect.anything());
  });

  it('disables teams not associated with project', async () => {
    const project = ProjectFixture();
    const teamWithProject = TeamFixture({projects: [project], slug: 'my-team'});
    const teamWithoutProject = TeamFixture({id: '2', slug: 'disabled-team'});
    TeamStore.init();
    TeamStore.loadInitialData([teamWithProject, teamWithoutProject]);

    const mock = jest.fn();
    render(
      <SentryMemberTeamSelectorField
        label="Select Owner"
        onChange={mock}
        memberOfProjectSlugs={[project.slug]}
        name="team-or-member"
        multiple
      />
    );

    await selectEvent.openMenu(screen.getByRole('textbox', {name: 'Select Owner'}));
    expect(
      within(
        (await screen.findByText('My Teams')).parentElement as HTMLElement
      ).getByText('#my-team')
    ).toBeInTheDocument();

    expect(
      within(
        (await screen.findByText('Disabled Teams')).parentElement as HTMLElement
      ).getByText('#disabled-team')
    ).toBeInTheDocument();
  });
});
