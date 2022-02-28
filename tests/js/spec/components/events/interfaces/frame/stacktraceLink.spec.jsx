import {mountWithTheme} from 'sentry-test/enzyme';

import {StacktraceLink} from 'sentry/components/events/interfaces/frame/stacktraceLink';

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

  it('does not render setup CTA for members', async function () {
    const memberOrg = TestStubs.Organization({
      slug: 'hello-org',
      access: [],
    });
    MockApiClient.addMockResponse({
      url: `/projects/${memberOrg.slug}/${project.slug}/stacktrace-link/`,
      query: {file: frame.filename, commitId: 'master', platform},
      body: {config: null, sourceUrl: null, integrations: [integration]},
    });
    MockApiClient.addMockResponse({
      method: 'GET',
      url: '/prompts-activity/',
      body: {},
    });
    const wrapper = mountWithTheme(
      <StacktraceLink
        frame={frame}
        event={event}
        projects={[project]}
        organization={memberOrg}
        lineNo={frame.lineNo}
      />
    );
    await tick();
    wrapper.update();
    expect(wrapper.find('CodeMappingButtonContainer').exists()).toBe(false);
  });

  it('renders setup CTA with integration but no configs', async function () {
    MockApiClient.addMockResponse({
      url: `/projects/${org.slug}/${project.slug}/stacktrace-link/`,
      query: {file: frame.filename, commitId: 'master', platform},
      body: {config: null, sourceUrl: null, integrations: [integration]},
    });
    MockApiClient.addMockResponse({
      method: 'GET',
      url: '/prompts-activity/',
      body: {},
    });
    const wrapper = mountWithTheme(
      <StacktraceLink
        frame={frame}
        event={event}
        projects={[project]}
        organization={org}
        lineNo={frame.lineNo}
      />
    );
    await tick();
    wrapper.update();
    expect(wrapper.find('CodeMappingButtonContainer').text()).toContain(
      'Link your stack trace to your source code.'
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
      />
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
        attemptedUrl: 'https://something.io/blah',
      },
    });
    const wrapper = mountWithTheme(
      <StacktraceLink
        frame={frame}
        event={event}
        projects={[project]}
        organization={org}
        lineNo={frame.lineNo}
      />
    );
    expect(wrapper.state('match').sourceUrl).toBeFalsy();
    expect(wrapper.find('CodeMappingButtonContainer').text()).toContain(
      'Source file not found.'
    );
    expect(wrapper.state('match').attemptedUrl).toEqual('https://something.io/blah');
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
      />
    );
    expect(wrapper.state('match').sourceUrl).toBeFalsy();
    expect(wrapper.find('CodeMappingButtonContainer').text()).toContain(
      'Error matching your configuration.'
    );
  });

  it('renders default error message', async function () {
    MockApiClient.addMockResponse({
      url: `/projects/${org.slug}/${project.slug}/stacktrace-link/`,
      query: {file: frame.filename, commitId: 'master', platform},
      body: {
        config,
        sourceUrl: null,
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
      />
    );
    expect(wrapper.state('match').sourceUrl).toBeFalsy();
    expect(wrapper.find('CodeMappingButtonContainer').text()).toContain(
      'There was an error encountered with the code mapping for this project'
    );
  });
});
