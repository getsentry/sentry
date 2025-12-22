import {OrganizationFixture} from 'sentry-fixture/organization';
import {ProjectFixture} from 'sentry-fixture/project';
import {TeamFixture} from 'sentry-fixture/team';

import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import MissingProjectMembership from 'sentry/components/projects/missingProjectMembership';
import TeamStore from 'sentry/stores/teamStore';

describe('MissingProjectMembership', () => {
  afterEach(() => {
    TeamStore.reset();
    MockApiClient.clearMockResponses();
  });

  it('allows selecting team, requesting access, and transitions to pending state', async () => {
    const organization = OrganizationFixture({features: []});
    const team = TeamFixture({slug: 'team-a', isPending: false});

    TeamStore.loadInitialData([team]);

    const project = ProjectFixture({teams: [TeamFixture({slug: 'team-a'})]});

    const joinTeamMock = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/members/me/teams/team-a/',
      method: 'POST',
      body: TeamFixture({slug: 'team-a', isPending: true}),
    });

    render(<MissingProjectMembership organization={organization} project={project} />);

    expect(await screen.findByRole('button', {name: 'Select a Team'})).toBeDisabled();
    expect(screen.getByText("You're not a member of this project.")).toBeInTheDocument();

    const selectInput = screen.getByRole('textbox');
    await userEvent.click(selectInput);

    // Join team
    const teamOption = await screen.findByText('#team-a');
    await userEvent.click(teamOption);

    expect(
      await screen.findByRole('button', {name: 'Request Access'})
    ).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', {name: 'Request Access'}));

    expect(joinTeamMock).toHaveBeenCalled();

    expect(
      await screen.findByRole('button', {name: 'Request Pending'})
    ).toBeInTheDocument();
  });
});
