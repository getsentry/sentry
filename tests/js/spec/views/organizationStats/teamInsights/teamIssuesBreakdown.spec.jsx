import {mountWithTheme, screen} from 'sentry-test/reactTestingLibrary';

import TeamIssuesBreakdown from 'sentry/views/organizationStats/teamInsights/teamIssuesBreakdown';

describe('TeamIssuesBreakdown', () => {
  it('should render graph with table of issues reviewed', async () => {
    const team = TestStubs.Team();
    const project = TestStubs.Project({id: '2', slug: 'javascript'});
    const organization = TestStubs.Organization();
    const teamIssuesActions = MockApiClient.addMockResponse({
      url: `/teams/${organization.slug}/${team.slug}/issue-breakdown/`,
      body: TestStubs.TeamIssuesBreakdown(),
    });
    const statuses = ['new', 'regressed', 'unignored'];
    mountWithTheme(
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
    expect(screen.getByText('40')).toBeInTheDocument();
    // Reviewed
    expect(screen.getByText('11')).toBeInTheDocument();
    expect(teamIssuesActions).toHaveBeenCalledTimes(1);
  });
});
