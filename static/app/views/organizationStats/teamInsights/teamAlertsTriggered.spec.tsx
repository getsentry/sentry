import {Organization} from 'sentry-fixture/organization';
import {Project as ProjectFixture} from 'sentry-fixture/project';
import {Team} from 'sentry-fixture/team';
import {TeamAlertsTriggered as TeamAlertsTriggeredFixture} from 'sentry-fixture/teamAlertsTriggered';

import {render} from 'sentry-test/reactTestingLibrary';

import TeamAlertsTriggered from 'sentry/views/organizationStats/teamInsights/teamAlertsTriggered';

describe('TeamAlertsTriggered', () => {
  it('should render graph of alerts triggered', () => {
    const team = Team();
    const organization = Organization();
    const project = ProjectFixture();

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
