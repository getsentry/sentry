import React from 'react';

import {mountWithTheme} from 'sentry-test/enzyme';

import ProcessingIssueHint from 'app/components/stream/processingIssueHint';

describe('ProcessingIssueHint', function () {
  let issue, wrapper;
  const orgId = 'test-org';
  const projectId = 'test-project';

  beforeEach(() => {
    issue = {
      hasIssues: false,
      hasMoreResolveableIssues: false,
      issuesProcessing: 0,
      lastSeen: '2019-01-16T15:38:38Z',
      numIssues: 0,
      resolveableIssues: 0,
      signedLink: null,
    };
  });

  describe('numIssues state', function () {
    beforeEach(() => {
      issue.numIssues = 9;
      wrapper = mountWithTheme(
        <ProcessingIssueHint issue={issue} orgId={orgId} projectId={projectId} />
      );
    });

    it('displays a button', function () {
      const button = wrapper.find('Button');
      expect(button.length).toBe(1);
      expect(button.props().to).toEqual(
        `/settings/${orgId}/projects/${projectId}/processing-issues/`
      );
    });

    it('displays an icon', function () {
      const icon = wrapper.find('IconWarning');
      expect(icon.length).toBe(1);
    });

    it('displays text', function () {
      const text = wrapper.find('Wrapper').text();
      expect(text).toEqual(expect.stringContaining('issues blocking'));
    });
  });

  describe('issuesProcessing state', function () {
    beforeEach(() => {
      issue.issuesProcessing = 9;
      wrapper = mountWithTheme(
        <ProcessingIssueHint issue={issue} orgId={orgId} projectId={projectId} />
      );
    });

    it('does not display a button', function () {
      const button = wrapper.find('Button');
      expect(button.length).toBe(0);
    });

    it('displays an icon', function () {
      const icon = wrapper.find('IconSettings');
      expect(icon.length).toBe(1);
    });

    it('displays text', function () {
      const text = wrapper.find('Wrapper').text();
      expect(text).toEqual(expect.stringContaining('Reprocessing'));
    });
  });

  describe('resolvableIssues state', function () {
    beforeEach(() => {
      issue.resolveableIssues = 9;
      wrapper = mountWithTheme(
        <ProcessingIssueHint issue={issue} orgId={orgId} projectId={projectId} />
      );
    });

    it('displays a button', function () {
      const button = wrapper.find('Button');
      expect(button.length).toBe(1);
      expect(button.props().to).toEqual(
        `/settings/${orgId}/projects/${projectId}/processing-issues/`
      );
    });

    it('displays an icon', function () {
      const icon = wrapper.find('IconSettings');
      expect(icon.length).toBe(1);
    });

    it('displays text', function () {
      const text = wrapper.find('Wrapper').text();
      expect(text).toEqual(expect.stringContaining('pending reprocessing'));
    });
  });

  describe('showProject state', function () {
    beforeEach(() => {
      issue.numIssues = 9;
      wrapper = mountWithTheme(
        <ProcessingIssueHint
          showProject
          issue={issue}
          orgId={orgId}
          projectId={projectId}
        />
      );
    });
    it('displays the project slug', function () {
      const text = wrapper.find('Wrapper').text();
      expect(text).toEqual(expect.stringContaining(projectId));
    });
  });
});
