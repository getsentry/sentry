import {mountWithTheme, screen} from 'sentry-test/reactTestingLibrary';

import TeamIssuesAge from 'sentry/views/organizationStats/teamInsights/teamIssuesAge';

describe('TeamIssuesAge', () => {
  it('should render graph with table of oldest issues', () => {
    const team = TestStubs.Team();
    const organization = TestStubs.Organization();
    const timeToResolutionApi = MockApiClient.addMockResponse({
      url: `/teams/${organization.slug}/${team.slug}/unresolved-issue-age/`,
      body: {
        '< 1 hour': 1,
        '< 2 hour': 2,
        '< 4 hour': 5,
        '< 8 hour': 10,
        '< 12 hour': 20,
        '< 1 day': 80,
        '< 1 week': 30,
        '< 2 week': 20,
        '< 4 week': 100,
        '< 8 week': 41,
        '< 24 week': 50,
        '< 1 year': 100,
        '> 1 year': 10,
      },
    });
    const issuesApi = MockApiClient.addMockResponse({
      url: `/teams/${organization.slug}/${team.slug}/issues/old/`,
      body: [TestStubs.Group()],
    });
    mountWithTheme(<TeamIssuesAge organization={organization} teamSlug={team.slug} />);

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
