import React from 'react';

import {initializeOrg} from 'sentry-test/initializeOrg';
import {mountWithTheme} from 'sentry-test/enzyme';

import ProjectAlerts from 'app/views/settings/projectAlerts';
import ProjectAlertsList from 'app/views/settings/projectAlerts/list';

describe('ProjectAlertsList', function() {
  let listMock;
  beforeEach(function() {
    listMock = MockApiClient.addMockResponse({
      url: '/projects/org-slug/project-slug/combined-rules/',
      body: [TestStubs.ProjectAlertRule()],
    });
  });

  afterEach(function() {
    MockApiClient.clearMockResponses();
  });

  const createWrapper = props => {
    const {organization, project, routerContext} = initializeOrg(props);
    const params = {orgId: organization.slug, projectId: project.slug};
    const wrapper = mountWithTheme(
      <ProjectAlerts organization={organization} params={params}>
        <ProjectAlertsList params={params} />
      </ProjectAlerts>,
      routerContext
    );

    return {
      wrapper,
      organization,
      project,
    };
  };

  it('lists alert rules', function() {
    const {wrapper} = createWrapper();

    expect(listMock).toHaveBeenCalled();

    expect(
      wrapper
        .find('RuleType')
        .at(0)
        .text()
    ).toBe('Issue');

    expect(
      wrapper
        .find('RuleName')
        .at(0)
        .text()
    ).toBe('My alert rule');

    expect(
      wrapper
        .find('RuleDescription')
        .at(0)
        .text()
    ).toBe('Environment: staging');

    expect(
      wrapper
        .find('Conditions')
        .at(0)
        .text()
    ).toBe('An alert is first seen');

    expect(
      wrapper
        .find('Actions')
        .at(0)
        .text()
    ).toBe('Send a notification to all services');

    // Has correct link to details
    expect(wrapper.find('RuleName').prop('to')).toBe('rules/1/');
  });

  it('has disabled edit rule button without access', function() {
    const {wrapper} = createWrapper({
      organization: {
        access: [],
      },
    });

    expect(
      wrapper.find('button[aria-label="New Alert Rule"]').prop('aria-disabled')
    ).toBe(true);
    expect(
      wrapper
        .find('RuleDescription')
        .at(0)
        .text()
    ).toBe('Environment: staging');
    expect(wrapper.find('RuleName')).toHaveLength(0);
  });
});
