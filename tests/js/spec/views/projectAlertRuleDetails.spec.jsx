import React from 'react';
import {mount} from 'enzyme';
import {browserHistory} from 'react-router';

import {Client} from 'app/api';

import ProjectAlertRuleDetails from 'app/views/projectAlertRuleDetails';

jest.mock('jquery');

describe('ProjectAlertRuleDetails', function() {
  let sandbox, replaceState;
  beforeEach(function() {
    sandbox = sinon.sandbox.create();
    Client.clearMockResponses();
    MockApiClient.addMockResponse({
      url: '/projects/org-slug/project-slug/rules/configuration/',
      method: 'GET',
      body: TestStubs.ProjectAlertRuleConfiguration(),
    });
    Client.addMockResponse({
      url: '/projects/org-slug/project-slug/rules/1/',
      method: 'GET',
      body: TestStubs.ProjectAlertRule(),
    });

    replaceState = sandbox.stub(browserHistory, 'replace');
  });

  afterEach(function() {
    sandbox.restore();
  });

  describe('New alert rule', function() {
    let wrapper, mock;
    beforeEach(function() {
      mock = Client.addMockResponse({
        url: '/projects/org-slug/project-slug/rules/',
        method: 'POST',
        body: TestStubs.ProjectAlertRule(),
      });

      wrapper = mount(
        <ProjectAlertRuleDetails
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

    // TODO: Rewrite the rule editor to not use  ReactDOM.findDOMNode so this can be tested
    xdescribe('update', function() {
      let name;
      beforeEach(function() {
        name = wrapper.find('input').first();
        name.value = 'My rule';
        name.simulate('change');

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
        let url = '/org-slug/project-slug/settings/alerts/rules/1/';
        expect(replaceState.calledWith(url)).toBe(true);
      });
    });
  });

  describe('Edit alert rule', function() {
    let wrapper, mock;
    beforeEach(function() {
      mock = Client.addMockResponse({
        url: '/projects/org-slug/project-slug/rules/',
        method: 'PUT',
        body: TestStubs.ProjectAlertRule(),
      });

      wrapper = mount(
        <ProjectAlertRuleDetails
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

    // TODO: Rewrite the rule editor to not use  ReactDOM.findDOMNode so this can be tested
    xit('updates', function() {
      let name = wrapper.find('input').first();
      name.value = 'My rule';
      name.simulate('change');

      wrapper.find('form').simulate('submit');
      expect(mock).toHaveBeenCalled();
    });
  });
});
