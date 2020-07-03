import React from 'react';

import {mountWithTheme} from 'sentry-test/enzyme';
import {initializeOrg} from 'sentry-test/initializeOrg';

import IncidentRulesList from 'app/views/settings/incidentRules/list';

describe('Incident Rules List', function() {
  it('renders', function() {
    const {organization, routerContext} = initializeOrg();
    const rule = TestStubs.IncidentRule();
    const req = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/alert-rules/`,
      body: [rule],
    });
    const wrapper = mountWithTheme(
      <IncidentRulesList
        params={{orgId: organization.slug}}
        organization={organization}
      />,
      routerContext
    );

    expect(req).toHaveBeenCalled();
    expect(wrapper.find('RuleLink').text()).toEqual('My Incident Rule');
    expect(wrapper.find('MetricName').text()).toEqual('count()');

    expect(wrapper.find('Thresholds').text()).toEqual('70');
  });
});
