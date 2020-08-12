import React from 'react';

import {mountWithTheme} from 'sentry-test/enzyme';

import ProcessingIssueList from 'app/components/stream/processingIssueList';

describe('ProcessingIssueList', function() {
  let wrapper, projects, organization, fetchIssueRequest;

  beforeEach(function() {
    fetchIssueRequest = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/processingissues/',
      method: 'GET',
      body: [
        {
          project: 'test-project',
          numIssues: 1,
          hasIssues: true,
          lastSeen: '2019-01-16T15:39:11.081Z',
        },
        {
          project: 'other-project',
          numIssues: 1,
          hasIssues: true,
          lastSeen: '2019-01-16T15:39:11.081Z',
        },
      ],
    });
    organization = TestStubs.Organization();
    projects = [1, 2];
  });

  describe('componentDidMount', function() {
    let instance;
    beforeEach(async function() {
      wrapper = mountWithTheme(
        <ProcessingIssueList organization={organization} projects={projects} />
      );
      instance = wrapper.instance();
      await instance.componentDidMount();
    });

    it('fetches issues', function() {
      expect(instance.state.issues).toBeTruthy();
      expect(fetchIssueRequest).toHaveBeenCalled();
    });
  });

  describe('render', function() {
    beforeEach(async function() {
      wrapper = mountWithTheme(
        <ProcessingIssueList
          organization={organization}
          projects={projects}
          showProject
        />
      );
      await wrapper.instance().componentDidMount();
      await wrapper.update();
    });

    it('renders multiple issues', function() {
      expect(wrapper.find('ProcessingIssueHint')).toHaveLength(2);
    });

    it('forwards the showProject prop', function() {
      const hint = wrapper.find('ProcessingIssueHint').first();
      expect(hint.props().showProject).toBeTruthy();
    });
  });
});
