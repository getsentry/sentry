import {Group as GroupFixture} from 'sentry-fixture/group';
import {Organization} from 'sentry-fixture/organization';
import {Team} from 'sentry-fixture/team';

import {render, screen} from 'sentry-test/reactTestingLibrary';

import TeamIssuesAge from 'sentry/views/organizationStats/teamInsights/teamIssuesAge';

describe('TeamIssuesAge', () => {
  it('should render graph with table of oldest issues', async () => {
    const team = Team();
    const organization = Organization();
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
      body: [GroupFixture()],
    });
    render(<TeamIssuesAge organization={organization} teamSlug={team.slug} />);

    // Title
    expect(await screen.findByText('RequestError')).toBeInTheDocument();
    // Event count
    expect(screen.getByText('327k')).toBeInTheDocument();
    // User count
    expect(screen.getByText('35k')).toBeInTheDocument();
    expect(timeToResolutionApi).toHaveBeenCalledTimes(1);
    expect(issuesApi).toHaveBeenCalledTimes(1);
  });
});
