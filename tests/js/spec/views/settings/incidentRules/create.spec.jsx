import {mountWithTheme} from 'sentry-test/enzyme';
import React from 'react';

import {initializeOrg} from 'sentry-test/initializeOrg';
import IncidentRulesCreate from 'app/views/settings/incidentRules/create';

describe('Incident Rules Create', function() {
  beforeEach(function() {
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

  it('renders', function() {
    const {organization, project, routerContext} = initializeOrg();
    mountWithTheme(
      <IncidentRulesCreate
        params={{orgId: organization.slug}}
        organization={organization}
        project={project}
      />,
      routerContext
    );
  });
});
