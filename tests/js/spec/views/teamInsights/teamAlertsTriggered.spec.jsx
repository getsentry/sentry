import {mountWithTheme, screen, waitFor} from 'sentry-test/reactTestingLibrary';

import TeamAlertsTriggered from 'app/views/teamInsights/teamAlertsTriggered';

describe('TeamAlertsTriggered', () => {
  it('should render graph of alerts triggered', async () => {
    const team = TestStubs.Team();
    const organization = TestStubs.Organization();
    const alertsTriggeredApi = MockApiClient.addMockResponse({
      url: `/teams/${organization.slug}/${team.slug}/alerts-triggered/`,
      body: TestStubs.TeamAlertsTriggered(),
    });
    mountWithTheme(
      <TeamAlertsTriggered organization={organization} teamSlug={team.slug} period="8w" />
    );

    await waitFor(() => {
      expect(screen.queryByTestId('loading-indicator')).not.toBeInTheDocument();
    });

    expect(alertsTriggeredApi).toHaveBeenCalledTimes(1);
  });
});
