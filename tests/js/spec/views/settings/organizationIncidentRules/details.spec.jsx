import {mount} from 'enzyme';
import React from 'react';

import {initializeOrg} from 'app-test/helpers/initializeOrg';
import IncidentRulesDetails from 'app/views/settings/organizationIncidentRules/details';

describe('Incident Rules Details', function() {
  it('renders', function() {
    const {organization, routerContext} = initializeOrg();
    mount(
      <IncidentRulesDetails
        params={{orgId: organization.slug}}
        organization={organization}
      />,
      routerContext
    );
  });
});
