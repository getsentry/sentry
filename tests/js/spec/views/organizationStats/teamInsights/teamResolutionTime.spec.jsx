import {mountWithTheme, screen, waitFor} from 'sentry-test/reactTestingLibrary';

import TeamResolutionTime from 'app/views/organizationStats/teamInsights/teamResolutionTime';

describe('TeamResolutionTime', () => {
  it('should render graph of issue time to resolution', async () => {
    const team = TestStubs.Team();
    const organization = TestStubs.Organization();
    const timeToResolutionApi = MockApiClient.addMockResponse({
      url: `/teams/${organization.slug}/${team.slug}/time-to-resolution/`,
      body: TestStubs.TeamResolutionTime(),
    });
    mountWithTheme(
      <TeamResolutionTime organization={organization} teamSlug={team.slug} period="8w" />
    );

    await waitFor(() => {
      expect(screen.queryByTestId('loading-indicator')).not.toBeInTheDocument();
    });

    expect(timeToResolutionApi).toHaveBeenCalledTimes(1);
  });
});
