import React from 'react';

import {mountWithTheme} from 'sentry-test/enzyme';

import ExternalIssueActions from 'app/components/group/externalIssueActions';

describe('ExternalIssueActions', function () {
  const group = TestStubs.Group();

  describe('with no external issues linked', function () {
    const integration = TestStubs.GitHubIntegration({externalIssues: []});
    const configurations = [integration];
    const wrapper = mountWithTheme(
      <ExternalIssueActions
        key={'github'}
        group={group}
        configurations={configurations}
        onChange={() => {}}
      />,

      TestStubs.routerContext()
    );

    // console.log(configurations);
    it('renders', function () {
      expect(wrapper).toSnapshot();
    });

    it('renders Link GitHub Issue when no issues currently linked', function () {
      expect(wrapper.find('IntegrationLink a').text()).toEqual('Link GitHub Issue');
    });

    it('should not have `+` icon', function () {
      let container = wrapper.find('IssueSyncListElementContainer').first();
      expect(container.contains('StyledIcon')).toBe(false);
    });

    describe('opens modal', function () {
      MockApiClient.addMockResponse({
        url: '/groups/1/integrations/1/?action=create',
        body: {createIssueConfig: []},
      });

      it('opens when clicking text', function () {
        wrapper.find('IntegrationLink a').simulate('click');
        expect(wrapper.find('Hovercard').first().prop('header')).toEqual(
          'Linked GitHub Integration'
        );
      });
    });
  });

  describe('with an external issue linked', function () {
    const externalIssues = [
      {
        id: 100,
        url: 'https://github.com/MeredithAnya/testing/issues/2',
        key: 'getsentry/sentry#2',
      },
    ];
    const integration = TestStubs.GitHubIntegration({externalIssues});
    const configurations = [integration];
    const wrapper = mountWithTheme(
      <ExternalIssueActions
        key="github"
        group={group}
        configurations={configurations}
        onChange={() => {}}
      />,
      TestStubs.routerContext()
    );
    it('renders', function () {
      expect(wrapper.find('IssueSyncElement')).toHaveLength(0);
    });

    it('renders Link GitHub Issue when no issues currently linked', function () {
      expect(wrapper.find('IntegrationLink a').text()).toEqual('getsentry/sentry#2');
    });

    describe('deletes linked issue', function () {
      const mockDelete = MockApiClient.addMockResponse({
        url: '/groups/1/integrations/1/?externalIssue=100',
        method: 'DELETE',
      });

      it('deletes when clicking x', function () {
        wrapper.find('StyledIcon').simulate('click');
        expect(mockDelete).toHaveBeenCalled();
      });
    });
  });
});
