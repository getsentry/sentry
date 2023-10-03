import {Organization} from 'sentry-fixture/organization';
import {TeamAlertsTriggered as TeamAlertsTriggeredFixture} from 'sentry-fixture/teamAlertsTriggered';

import {render} from 'sentry-test/reactTestingLibrary';

import TeamAlertsTriggered from 'sentry/views/organizationStats/teamInsights/teamAlertsTriggered';

describe('TeamAlertsTriggered', () => {
  it('should render graph of alerts triggered', () => {
    const team = TestStubs.Team();
    const organization = Organization();
    const project = TestStubs.Project();

    const alertsTriggeredApi = MockApiClient.addMockResponse({
      url: `/teams/${organization.slug}/${team.slug}/alerts-triggered/`,
      body: TeamAlertsTriggeredFixture(),
    });

    MockApiClient.addMockResponse({
      url: `/teams/${organization.slug}/${team.slug}/alerts-triggered-index/`,
      body: [],
    });

    render(
      <TeamAlertsTriggered
        organization={organization}
        projects={[project]}
        teamSlug={team.slug}
        period="8w"
      />
    );

    expect(alertsTriggeredApi).toHaveBeenCalledTimes(1);
  });
});
