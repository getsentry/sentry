import {mountWithTheme, waitFor} from 'sentry-test/reactTestingLibrary';

import TeamIssuesReviewed from 'app/views/teamInsights/teamIssuesReviewed';

describe('TeamResolutionTime', () => {
  it('should render graph of issue time to resolution', async () => {
    const team = TestStubs.Team();
    const project = TestStubs.Project({id: '2', slug: 'javascript'});
    const organization = TestStubs.Organization();
    const timeToResolutionApi = MockApiClient.addMockResponse({
      url: `/teams/${organization.slug}/${team.slug}/issue-breakdown/`,
      body: TestStubs.TeamIssuesReviewed(),
    });
    const wrapper = mountWithTheme(
      <TeamIssuesReviewed
        organization={organization}
        projects={[project]}
        teamSlug={team.slug}
        period="8w"
      />
    );

    await waitFor(() => {
      expect(wrapper.queryByTestId('loading-indicator')).not.toBeInTheDocument();
    });

    expect(wrapper.getByText('javascript')).toBeInTheDocument();
    // Total
    expect(wrapper.getByText('40')).toBeInTheDocument();
    // Reviewed
    expect(wrapper.getByText('11')).toBeInTheDocument();
    expect(timeToResolutionApi).toHaveBeenCalledTimes(1);
    expect(wrapper.container).toSnapshot();
  });
});
