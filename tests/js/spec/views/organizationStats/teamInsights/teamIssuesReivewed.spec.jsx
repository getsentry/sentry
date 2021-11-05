import {mountWithTheme, screen} from 'sentry-test/reactTestingLibrary';

import TeamIssuesReviewed from 'app/views/organizationStats/teamInsights/teamIssuesReviewed';

describe('TeamIssuesReviewed', () => {
  it('should render graph with table of issues reviewed', async () => {
    const team = TestStubs.Team();
    const project = TestStubs.Project({id: '2', slug: 'javascript'});
    const organization = TestStubs.Organization();
    const timeToResolutionApi = MockApiClient.addMockResponse({
      url: `/teams/${organization.slug}/${team.slug}/issue-breakdown/`,
      body: TestStubs.TeamIssuesReviewed(),
    });
    mountWithTheme(
      <TeamIssuesReviewed
        organization={organization}
        projects={[project]}
        teamSlug={team.slug}
        period="8w"
      />
    );

    expect(screen.getByText('javascript')).toBeInTheDocument();
    // Total
    expect(screen.getByText('40')).toBeInTheDocument();
    // Reviewed
    expect(screen.getByText('11')).toBeInTheDocument();
    expect(timeToResolutionApi).toHaveBeenCalledTimes(1);
  });
});
