import {Organization} from 'fixtures/js-stubs/organization';
import {Team} from 'fixtures/js-stubs/team';

import {render} from 'sentry-test/reactTestingLibrary';

import TeamAlertsTriggered from 'sentry/views/organizationStats/teamInsights/teamAlertsTriggered';

describe('TeamAlertsTriggered', () => {
  it('should render graph of alerts triggered', () => {
    const team = Team();
    const organization = Organization();
    const alertsTriggeredApi = MockApiClient.addMockResponse({
      url: `/teams/${organization.slug}/${team.slug}/alerts-triggered/`,
      body: TeamAlertsTriggered(),
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
