import React from 'react';

import {initializeOrg} from 'sentry-test/initializeOrg';
import {mountWithTheme} from 'sentry-test/enzyme';

import {Client} from 'app/api';
import Settings from 'app/views/settings/projectAlerts/settings';

describe('ProjectAlertSettings', function () {
  let organization;
  let project;
  let routerContext;

  beforeEach(function () {
    ({organization, project, routerContext} = initializeOrg());

    Client.addMockResponse({
      url: `/projects/${organization.slug}/${project.slug}/`,
      method: 'GET',
      body: project,
    });
    Client.addMockResponse({
      url: `/projects/${organization.slug}/${project.slug}/plugins/`,
      method: 'GET',
      body: [],
    });
  });

  it('renders', function () {
    const wrapper = mountWithTheme(
      <Settings
        canEditRule
        params={{orgId: organization.slug, projectId: project.slug}}
        organization={organization}
        routes={[]}
      />,
      routerContext
    );

    expect(wrapper.find('Input[name="subjectTemplate"]')).toHaveLength(1);
    expect(wrapper.find('RangeSlider[name="digestsMinDelay"]')).toHaveLength(1);
    expect(wrapper.find('RangeSlider[name="digestsMaxDelay"]')).toHaveLength(1);
    expect(wrapper.find('PluginList')).toHaveLength(1);
  });
});
