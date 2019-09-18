import {mount} from 'enzyme';
import React from 'react';

import {initializeOrg} from 'app-test/helpers/initializeOrg';
import IncidentRulesDetails from 'app/views/settings/incidentRules/details';

describe('Incident Rules Details', function() {
  it('renders', function() {
    const {organization, routerContext} = initializeOrg();
    const rule = TestStubs.IncidentRule();
    const req = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/alert-rules/${rule.id}/`,
      body: rule,
    });
    mount(
      <IncidentRulesDetails
        params={{
          orgId: organization.slug,
          incidentRuleId: rule.id,
        }}
        organization={organization}
      />,
      routerContext
    );

    expect(req).toHaveBeenCalled();
  });
});
