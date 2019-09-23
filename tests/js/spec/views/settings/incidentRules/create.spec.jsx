import {mount} from 'enzyme';
import React from 'react';

import {initializeOrg} from 'app-test/helpers/initializeOrg';
import IncidentRulesCreate from 'app/views/settings/incidentRules/create';

describe('Incident Rules Create', function() {
  it('renders', function() {
    const {organization, routerContext} = initializeOrg();
    mount(
      <IncidentRulesCreate
        params={{orgId: organization.slug}}
        organization={organization}
      />,
      routerContext
    );
  });
});
