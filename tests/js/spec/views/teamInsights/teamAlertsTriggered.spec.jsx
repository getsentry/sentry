import {mountWithTheme, waitFor} from 'sentry-test/reactTestingLibrary';

import TeamAlertsTriggered from 'app/views/teamInsights/teamAlertsTriggered';

describe('TeamAlertsTriggered', () => {
  it('should render graph of alerts triggered', async () => {
    const team = TestStubs.Team();
    const organization = TestStubs.Organization();
    const alertsTriggeredApi = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/${team.slug}/alerts-triggered/`,
      body: TestStubs.TeamAlertsTriggered(),
    });
    const wrapper = mountWithTheme(
      <TeamAlertsTriggered
        organization={organization}
        teamSlug={team.slug}
        period="14d"
      />
    );

    await waitFor(() => {
      expect(wrapper.queryByTestId('loading-indicator')).not.toBeInTheDocument();
    });

    expect(alertsTriggeredApi).toHaveBeenCalledTimes(1);
    expect(wrapper.container).toSnapshot();
  });
});
