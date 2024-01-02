import {Organization} from 'sentry-fixture/organization';
import {Project as ProjectFixture} from 'sentry-fixture/project';
import {Team} from 'sentry-fixture/team';
import {TeamIssuesBreakdown as TeamIssuesBreakdownFixture} from 'sentry-fixture/teamIssuesBreakdown';

import {render, screen} from 'sentry-test/reactTestingLibrary';

import TeamIssuesBreakdown from 'sentry/views/organizationStats/teamInsights/teamIssuesBreakdown';

describe('TeamIssuesBreakdown', () => {
  it('should render graph with table of issues reviewed', async () => {
    const team = Team();
    const project = ProjectFixture({id: '2', slug: 'javascript'});
    const organization = Organization();
    const teamIssuesActions = MockApiClient.addMockResponse({
      url: `/teams/${organization.slug}/${team.slug}/issue-breakdown/`,
      body: TeamIssuesBreakdownFixture(),
    });
    const statuses = ['new', 'regressed', 'unignored'];

    render(
      <TeamIssuesBreakdown
        organization={organization}
        projects={[project]}
        teamSlug={team.slug}
        period="8w"
        statuses={['new', 'regressed', 'unignored']}
      />
    );

    for (const status of statuses) {
      expect(screen.getByText(status)).toBeInTheDocument();
    }

    expect(await screen.findByText('javascript')).toBeInTheDocument();
    // Total
    expect(screen.getByText('49')).toBeInTheDocument();
    // Reviewed
    expect(screen.getAllByText('30')).toHaveLength(statuses.length);
    expect(teamIssuesActions).toHaveBeenCalledTimes(1);
  });
});
