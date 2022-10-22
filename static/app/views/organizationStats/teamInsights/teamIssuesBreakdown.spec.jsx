import {Organization} from 'fixtures/js-stubs/organization';
import {Project} from 'fixtures/js-stubs/project';
import {Team} from 'fixtures/js-stubs/team';

import {render, screen} from 'sentry-test/reactTestingLibrary';

import TeamIssuesBreakdown from 'sentry/views/organizationStats/teamInsights/teamIssuesBreakdown';

describe('TeamIssuesBreakdown', () => {
  it('should render graph with table of issues reviewed', () => {
    const team = Team();
    const project = Project({id: '2', slug: 'javascript'});
    const organization = Organization();
    const teamIssuesActions = MockApiClient.addMockResponse({
      url: `/teams/${organization.slug}/${team.slug}/issue-breakdown/`,
      body: TeamIssuesBreakdown(),
    });
    const statuses = ['new', 'regressed', 'unignored'];
    render(
      <TeamIssuesBreakdown
        organization={organization}
        projects={[project]}
        teamSlug={team.slug}
        period="8w"
        statuses={statuses}
      />
    );

    for (const status of statuses) {
      expect(screen.getByText(status)).toBeInTheDocument();
    }

    expect(screen.getByText('javascript')).toBeInTheDocument();
    // Total
    expect(screen.getByText('49')).toBeInTheDocument();
    // Reviewed
    expect(screen.getAllByText('30')).toHaveLength(statuses.length);
    expect(teamIssuesActions).toHaveBeenCalledTimes(1);
  });
});
