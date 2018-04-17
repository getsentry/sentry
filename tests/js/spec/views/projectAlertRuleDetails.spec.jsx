import React from 'react';
import {mount} from 'enzyme';
import {browserHistory} from 'react-router';

import ProjectAlertRuleDetails from 'app/views/settings/projectAlerts/projectAlertRuleDetails';
import EnvironmentStore from 'app/stores/environmentStore';

jest.mock('jquery');

describe('ProjectAlertRuleDetails', function() {
  let projectAlertRuleDetailsRoutes = [
    {
      path: '/',
    },
    {
      newnew: true,
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
      path: ':projectId/',
    },
    {},
    {
      indexRoute: {name: 'General'},
    },
    {
      name: 'Alerts',
      path: 'alerts/',
      indexRoute: {},
    },
    {
      path: 'rules/',
      name: 'Rules',
      component: null,
      indexRoute: {},
      childRoutes: [{path: 'new/', name: 'New'}, {path: ':ruleId/', name: 'Edit'}],
    },
    {path: ':ruleId/', name: 'Edit'},
  ];

  beforeEach(function() {
    browserHistory.replace = jest.fn();
    MockApiClient.addMockResponse({
      url: '/projects/org-slug/project-slug/rules/configuration/',
      method: 'GET',
      body: TestStubs.ProjectAlertRuleConfiguration(),
    });
    MockApiClient.addMockResponse({
      url: '/projects/org-slug/project-slug/rules/1/',
      method: 'GET',
      body: TestStubs.ProjectAlertRule(),
    });
    EnvironmentStore.loadActiveData(TestStubs.Environments());
  });

  afterEach(function() {
    MockApiClient.clearMockResponses();
  });

  describe('New alert rule', function() {
    let wrapper, mock;
    beforeEach(function() {
      mock = MockApiClient.addMockResponse({
        url: '/projects/org-slug/project-slug/rules/',
        method: 'POST',
        body: TestStubs.ProjectAlertRule(),
      });

      wrapper = mount(
        <ProjectAlertRuleDetails
          routes={projectAlertRuleDetailsRoutes}
          params={{orgId: 'org-slug', projectId: 'project-slug'}}
        />,
        {
          context: {
            project: TestStubs.Project(),
            organization: TestStubs.Organization(),
          },
        }
      );
    });
    it('renders', function() {
      expect(wrapper).toMatchSnapshot();
    });

    it('sets defaults', function() {
      let selects = wrapper.find('Select2Field');
      expect(selects.first().props().value).toBe('all');
      expect(selects.last().props().value).toBe(30);
    });

    describe('saves', function() {
      let name;
      beforeEach(function() {
        name = wrapper.find('input').first();
        name.simulate('change', {target: {value: 'My rule'}});

        wrapper.find('form').simulate('submit');
      });

      it('sends create request on save', function() {
        expect(mock).toHaveBeenCalled();

        expect(mock.mock.calls[0][1]).toMatchObject({
          data: {
            name: 'My rule',
          },
        });
      });

      it('updates URL', function() {
        let url = '/settings/org-slug/project-slug/alerts/rules/1/';
        expect(browserHistory.replace).toHaveBeenCalledWith(url);
      });
    });
  });

  describe('Edit alert rule', function() {
    let wrapper, mock;
    const endpoint = '/projects/org-slug/project-slug/rules/1/';
    beforeEach(function() {
      mock = MockApiClient.addMockResponse({
        url: endpoint,
        method: 'PUT',
        body: TestStubs.ProjectAlertRule(),
      });

      wrapper = mount(
        <ProjectAlertRuleDetails
          routes={projectAlertRuleDetailsRoutes}
          params={{orgId: 'org-slug', projectId: 'project-slug', ruleId: '1'}}
        />,
        {
          context: {
            project: TestStubs.Project(),
            organization: TestStubs.Organization(),
          },
        }
      );
    });
    it('renders', function() {
      expect(wrapper).toMatchSnapshot();
    });

    it('updates', function() {
      const name = wrapper.find('input').first();
      name.simulate('change', {target: {value: 'My rule'}});

      wrapper.find('form').simulate('submit');
      expect(mock).toHaveBeenCalled();
    });

    it('does not update URL', function() {
      expect(browserHistory.replace).not.toHaveBeenCalled();
    });

    it('sends correct environment value', function() {
      wrapper
        .find('select#id-environment')
        .simulate('change', {target: {value: 'production'}});
      expect(wrapper.find('select#id-environment').props().value).toBe('production');
      wrapper.find('form').simulate('submit');

      expect(mock).toHaveBeenCalledWith(
        endpoint,
        expect.objectContaining({
          data: expect.objectContaining({environment: 'production'}),
        })
      );
    });

    it('strips environment value if "All environments" is selected', function() {
      wrapper
        .find('select#id-environment')
        .simulate('change', {target: {value: '__all_environments__'}});
      wrapper.find('form').simulate('submit');

      expect(mock).not.toHaveBeenCalledWith(
        endpoint,
        expect.objectContaining({
          data: expect.objectContaining({environment: '__all_environments__'}),
        })
      );
    });
  });
});
