import React from 'react';

import {mountWithTheme} from 'sentry-test/enzyme';

import {StacktraceLink} from 'app/components/events/interfaces/stacktraceLink';

describe('StacktraceLink', function () {
  const org = TestStubs.Organization();
  const project = TestStubs.Project();
  const event = TestStubs.Event({projectID: project.id});
  const integration = TestStubs.GitHubIntegration();
  const repo = TestStubs.Repository({integrationId: integration.id});

  const frame = {filename: '/sentry/app.py', lineNo: 233};
  const platform = 'python';
  const config = TestStubs.RepositoryProjectPathConfig(project, repo, integration);

  beforeEach(function () {
    MockApiClient.clearMockResponses();
  });

  it('renders setup CTA with integration but no configs', async function () {
    MockApiClient.addMockResponse({
      url: `/projects/${org.slug}/${project.slug}/stacktrace-link/`,
      query: {file: frame.filename, commitId: 'master', platform},
      body: {config: null, sourceUrl: null, integrations: [integration]},
    });
    mountWithTheme(
      <StacktraceLink
        frame={frame}
        event={event}
        projects={[project]}
        organization={org}
        lineNo={frame.lineNo}
      />,
      TestStubs.routerContext()
    );
  });

  it('renders source url link', async function () {
    MockApiClient.addMockResponse({
      url: `/projects/${org.slug}/${project.slug}/stacktrace-link/`,
      query: {file: frame.filename, commitId: 'master', platform},
      body: {config, sourceUrl: 'https://something.io', integrations: [integration]},
    });
    const wrapper = mountWithTheme(
      <StacktraceLink
        frame={frame}
        event={event}
        projects={[project]}
        organization={org}
        lineNo={frame.lineNo}
      />,
      TestStubs.routerContext()
    );
    expect(wrapper.state('match').sourceUrl).toEqual('https://something.io');
    expect(wrapper.find('OpenInName').text()).toEqual('GitHub');
  });

  it('renders file_not_found message', async function () {
    MockApiClient.addMockResponse({
      url: `/projects/${org.slug}/${project.slug}/stacktrace-link/`,
      query: {file: frame.filename, commitId: 'master', platform},
      body: {
        config,
        sourceUrl: null,
        error: 'file_not_found',
        integrations: [integration],
      },
    });
    const wrapper = mountWithTheme(
      <StacktraceLink
        frame={frame}
        event={event}
        projects={[project]}
        organization={org}
        lineNo={frame.lineNo}
      />,
      TestStubs.routerContext()
    );
    expect(wrapper.state('match').sourceUrl).toBeFalsy();
    expect(wrapper.find('CodeMappingButtonContainer').text()).toContain(
      'Could not find source file, check your repository and source code root.'
    );
  });

  it('renders stack_root_mismatch message', async function () {
    MockApiClient.addMockResponse({
      url: `/projects/${org.slug}/${project.slug}/stacktrace-link/`,
      query: {file: frame.filename, commitId: 'master', platform},
      body: {
        config,
        sourceUrl: null,
        error: 'stack_root_mismatch',
        integrations: [integration],
      },
    });
    const wrapper = mountWithTheme(
      <StacktraceLink
        frame={frame}
        event={event}
        projects={[project]}
        organization={org}
        lineNo={frame.lineNo}
      />,
      TestStubs.routerContext()
    );
    expect(wrapper.state('match').sourceUrl).toBeFalsy();
    expect(wrapper.find('CodeMappingButtonContainer').text()).toContain(
      'Error matching your configuration, check your stack trace root.'
    );
  });
});
