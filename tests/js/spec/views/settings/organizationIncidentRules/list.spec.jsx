import {mount} from 'enzyme';
import React from 'react';

import {initializeOrg} from 'app-test/helpers/initializeOrg';
import IncidentRulesList from 'app/views/settings/projectIncidentRules/list';

describe('Incident Rules List', function() {
  it('renders', function() {
    const {organization, routerContext} = initializeOrg();
    mount(
      <IncidentRulesList
        params={{orgId: organization.slug}}
        organization={organization}
      />,
      routerContext
    );
  });
});
