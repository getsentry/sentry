import {render} from 'sentry-test/reactTestingLibrary';

import TeamAlertsTriggered from 'sentry/views/organizationStats/teamInsights/teamAlertsTriggered';

describe('TeamAlertsTriggered', () => {
  it('should render graph of alerts triggered', () => {
    const team = TestStubs.Team();
    const organization = TestStubs.Organization();
    const alertsTriggeredApi = MockApiClient.addMockResponse({
      url: `/teams/${organization.slug}/${team.slug}/alerts-triggered/`,
      body: TestStubs.TeamAlertsTriggered(),
    });

    MockApiClient.addMockResponse({
      url: `/teams/${organization.slug}/${team.slug}/alerts-triggered-index/`,
      body: [],
    });

    render(
      <TeamAlertsTriggered organization={organization} teamSlug={team.slug} period="8w" />
    );

    expect(alertsTriggeredApi).toHaveBeenCalledTimes(1);
  });
});
