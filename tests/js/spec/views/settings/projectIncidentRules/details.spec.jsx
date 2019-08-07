import {mount} from 'enzyme';
import React from 'react';

import {initializeOrg} from 'app-test/helpers/initializeOrg';
import IncidentRulesDetails from 'app/views/settings/projectIncidentRules/details';

describe('Incident Rules Details', function() {
  it('renders', function() {
    const {organization, project, routerContext} = initializeOrg();
    const rule = TestStubs.IncidentRule();
    const req = MockApiClient.addMockResponse({
      url: `/projects/${organization.slug}/${project.slug}/alert-rules/${rule.id}/`,
      body: rule,
    });
    mount(
      <IncidentRulesDetails
        params={{
          orgId: organization.slug,
          projectId: project.slug,
          incidentRuleId: rule.id,
        }}
        organization={organization}
      />,
      routerContext
    );

    expect(req).toHaveBeenCalled();
  });
});
