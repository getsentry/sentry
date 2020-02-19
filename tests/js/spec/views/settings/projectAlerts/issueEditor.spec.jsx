import {browserHistory} from 'react-router';
import React from 'react';

import {initializeOrg} from 'sentry-test/initializeOrg';
import {mountWithTheme} from 'sentry-test/enzyme';
import {selectByValue} from 'sentry-test/select-new';
import ProjectAlerts from 'app/views/settings/projectAlerts';
import IssueEditor from 'app/views/settings/projectAlerts/issueEditor';

jest.unmock('app/utils/recreateRoute');

describe('ProjectAlerts -> IssueEditor', function() {
  const projectAlertRuleDetailsRoutes = [
    {
      path: '/',
    },
    {
      path: '/settings/',
      name: 'Settings',
      indexRoute: {},
    },
    {
      name: 'Organization',
      path: ':orgId/',
    },
    {
      name: 'Project',
      path: 'projects/:projectId/',
    },
    {},
    {
      indexRoute: {name: 'General'},
    },
    {
      name: 'Alert Rules',
      path: 'alerts/',
      indexRoute: {},
    },
    {
      path: 'rules/',
      name: 'Rules',
      component: null,
      indexRoute: {},
      childRoutes: [
        {path: 'new/', name: 'New'},
        {path: ':ruleId/', name: 'Edit'},
      ],
    },
    {path: ':ruleId/', name: 'Edit Alert Rule'},
  ];

  beforeEach(async function() {
    browserHistory.replace = jest.fn();
    MockApiClient.addMockResponse({
      url: '/projects/org-slug/project-slug/rules/configuration/',
      body: TestStubs.ProjectAlertRuleConfiguration(),
    });
    MockApiClient.addMockResponse({
      url: '/projects/org-slug/project-slug/rules/1/',
      body: TestStubs.ProjectAlertRule(),
    });
    MockApiClient.addMockResponse({
      url: '/projects/org-slug/project-slug/environments/',
      body: TestStubs.Environments(),
    });
  });

  afterEach(function() {
    MockApiClient.clearMockResponses();
  });

  const createWrapper = (props = {}) => {
    const {organization, project, routerContext} = initializeOrg(props);
    const params = {orgId: organization.slug, projectId: project.slug, ruleId: '1'};
    const wrapper = mountWithTheme(
      <ProjectAlerts organization={organization} params={params}>
        <IssueEditor
          params={params}
          location={{pathname: ''}}
          routes={projectAlertRuleDetailsRoutes}
        />
      </ProjectAlerts>,
      routerContext
    );

    return {
      wrapper,
      organization,
      project,
    };
  };
  describe('Edit Rule', function() {
    let mock;
    const endpoint = '/projects/org-slug/project-slug/rules/1/';
    beforeEach(async function() {
      mock = MockApiClient.addMockResponse({
        url: endpoint,
        method: 'PUT',
        body: TestStubs.ProjectAlertRule(),
      });
    });

    it('deletes rule', async function() {
      const deleteMock = MockApiClient.addMockResponse({
        url: endpoint,
        method: 'DELETE',
        body: {},
      });
      const {wrapper} = createWrapper();
      wrapper.find('button[aria-label="Delete Rule"]').simulate('click');
      await tick();
      wrapper.find('Modal button[aria-label="Delete Rule"]').simulate('click');
      await tick();
      expect(deleteMock).toHaveBeenCalled();
      expect(browserHistory.replace).toHaveBeenCalledWith(
        '/settings/org-slug/projects/project-slug/alerts/'
      );
    });

    it('sends correct environment value', function() {
      const {wrapper} = createWrapper();
      selectByValue(wrapper, 'production', {name: 'environment'});
      wrapper.find('form').simulate('submit');

      expect(mock).toHaveBeenCalledWith(
        endpoint,
        expect.objectContaining({
          data: expect.objectContaining({environment: 'production'}),
        })
      );
    });

    it('strips environment value if "All environments" is selected', async function() {
      const {wrapper} = createWrapper();
      selectByValue(wrapper, '__all_environments__', {name: 'environment'});
      wrapper.find('form').simulate('submit');

      expect(mock).toHaveBeenCalledTimes(1);
      expect(mock).not.toHaveBeenCalledWith(
        endpoint,
        expect.objectContaining({
          data: expect.objectContaining({environment: '__all_environments__'}),
        })
      );
    });
  });
});
