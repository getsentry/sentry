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
  });

  it('renders', function() {
    const {organization, routerContext} = initializeOrg();
    mountWithTheme(
      <IncidentRulesCreate
        params={{orgId: organization.slug}}
        organization={organization}
      />,
      routerContext
    );
  });
});
