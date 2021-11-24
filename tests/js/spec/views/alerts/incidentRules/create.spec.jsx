import {initializeOrg} from 'sentry-test/initializeOrg';
import {mountWithTheme} from 'sentry-test/reactTestingLibrary';

import IncidentRulesCreate from 'sentry/views/alerts/incidentRules/create';

describe('Incident Rules Create', function () {
  let eventStatsMock;

  beforeEach(function () {
    MockApiClient.clearMockResponses();
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/tags/',
      body: [],
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/users/',
      body: [],
    });
    MockApiClient.addMockResponse({
      url: '/projects/org-slug/project-slug/environments/',
      body: [],
    });
    eventStatsMock = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/events-stats/',
      body: TestStubs.EventsStats(),
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/alert-rules/available-actions/',
      body: [
        {
          allowedTargetTypes: ['user', 'team'],
          integrationName: null,
          type: 'email',
          integrationId: null,
        },
      ],
    });
  });

  it('renders', function () {
    const {organization, project, routerContext} = initializeOrg();
    mountWithTheme(
      <IncidentRulesCreate
        params={{orgId: organization.slug, projectId: project.slug}}
        organization={organization}
        project={project}
        userTeamIds={[]}
      />,
      {context: routerContext}
    );

    expect(eventStatsMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        query: {
          interval: '1m',
          project: [2],
          query: 'event.type:error',
          statsPeriod: '1d',
          yAxis: 'count()',
          referrer: 'api.organization-event-stats',
        },
      })
    );
  });
});
