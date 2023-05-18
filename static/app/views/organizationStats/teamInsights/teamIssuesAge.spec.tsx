import {render, screen} from 'sentry-test/reactTestingLibrary';

import TeamIssuesAge from 'sentry/views/organizationStats/teamInsights/teamIssuesAge';

describe('TeamIssuesAge', () => {
  it('should render graph with table of oldest issues', () => {
    const team = TestStubs.Team();
    const organization = TestStubs.Organization();
    const timeToResolutionApi = MockApiClient.addMockResponse({
      url: `/teams/${organization.slug}/${team.slug}/unresolved-issue-age/`,
      body: {
        '< 1 hour': 1,
        '< 4 hour': 5,
        '< 12 hour': 20,
        '< 1 day': 80,
        '< 1 week': 30,
        '< 4 week': 100,
        '< 24 week': 50,
        '< 1 year': 100,
        '> 1 year': 10,
      },
    });
    const issuesApi = MockApiClient.addMockResponse({
      url: `/teams/${organization.slug}/${team.slug}/issues/old/`,
      body: [TestStubs.Group()],
    });
    render(<TeamIssuesAge organization={organization} teamSlug={team.slug} />);

    // Title
    expect(screen.getByText('RequestError')).toBeInTheDocument();
    // Event count
    expect(screen.getByText('327k')).toBeInTheDocument();
    // User count
    expect(screen.getByText('35k')).toBeInTheDocument();
    expect(timeToResolutionApi).toHaveBeenCalledTimes(1);
    expect(issuesApi).toHaveBeenCalledTimes(1);
  });
});
