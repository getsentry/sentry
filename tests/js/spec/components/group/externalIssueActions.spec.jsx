import React from 'react';
import {mount} from 'enzyme';

import ExternalIssueActions from 'app/components/group/externalIssueActions';

describe('ExternalIssueActions', function() {
  let group = TestStubs.Group();

  describe('with no external issues linked', function() {
    let integration = TestStubs.GitHubIntegration({externalIssues: []});
    let wrapper = mount(
      <ExternalIssueActions group={group} integration={integration} />,
      TestStubs.routerContext()
    );
    it('renders', function() {
      expect(wrapper).toMatchSnapshot();
    });

    it('renders Link GitHub Issue when no issues currently linked', function() {
      expect(wrapper.find('IntegrationLink a').text()).toEqual('Link GitHub Issue');
    });

    describe('opens modal', function() {
      MockApiClient.addMockResponse({
        url: '/groups/1/integrations/1/?action=create',
        body: {createIssueConfig: []},
      });
      it('opens when clicking text', function() {
        wrapper.find('IntegrationLink a').simulate('click');
        expect(
          wrapper
            .find('Modal')
            .first()
            .prop('show')
        ).toBe(true);
      });

      it('opens when clicking +', function() {
        wrapper.find('OpenCloseIcon').simulate('click');
        expect(
          wrapper
            .find('Modal')
            .first()
            .prop('show')
        ).toBe(true);
      });
    });
  });

  describe('with an external issue linked', function() {
    let externalIssues = [
      {id: '100', url: 'https://github.com/MeredithAnya/testing/issues/2'},
    ];
    let integration = TestStubs.GitHubIntegration({externalIssues});
    let wrapper = mount(
      <ExternalIssueActions group={group} integration={integration} />,
      TestStubs.routerContext()
    );
    it('renders', function() {
      expect(wrapper.find('IssueSyncElement')).toMatchSnapshot();
    });

    it('renders Link GitHub Issue when no issues currently linked', function() {
      expect(wrapper.find('IntegrationLink a').text()).toEqual('GH-100');
    });

    describe('deletes linked issue', function() {
      MockApiClient.addMockResponse({
        url: '/groups/1/integrations/1/?externalIssue=100',
        method: 'DELETE',
      });

      it('deletes when clicking x', function() {
        wrapper.find('OpenCloseIcon').simulate('click');
        expect(wrapper.find('IntegrationLink a').text()).toEqual('Link GitHub Issue');
      });
    });
  });
});
