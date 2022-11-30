import {render, screen, waitFor} from 'sentry-test/reactTestingLibrary';

import ProjectsStore from 'sentry/stores/projectsStore';

import {StacktraceLink} from './stacktraceLink';

describe('StacktraceLink', function () {
  const org = TestStubs.Organization();
  const project = TestStubs.Project();
  const event = TestStubs.Event({projectID: project.id});
  const integration = TestStubs.GitHubIntegration();
  const repo = TestStubs.Repository({integrationId: integration.id});

  const frame = {filename: '/sentry/app.py', lineNo: 233};
  const platform = 'python';
  const config = TestStubs.RepositoryProjectPathConfig({project, repo, integration});
  let promptActivity;

  beforeEach(function () {
    MockApiClient.clearMockResponses();
    promptActivity = MockApiClient.addMockResponse({
      method: 'GET',
      url: '/prompts-activity/',
      body: {},
    });
    ProjectsStore.loadInitialData([project]);
  });

  it('renders ask to setup integration', async function () {
    const stacktraceLinkMock = MockApiClient.addMockResponse({
      url: `/projects/${org.slug}/${project.slug}/stacktrace-link/`,
      query: {file: frame.filename, commitId: 'master', platform},
      body: {config: null, sourceUrl: null, integrations: []},
    });
    render(<StacktraceLink frame={frame} event={event} lineNo={frame.lineNo} />, {
      context: TestStubs.routerContext(),
    });
    expect(
      await screen.findByText(
        'Add a GitHub, Bitbucket, or similar integration to make sh*t easier for your team'
      )
    ).toBeInTheDocument();
    expect(stacktraceLinkMock).toHaveBeenCalledTimes(1);
    expect(promptActivity).toHaveBeenCalledTimes(1);
  });

  it('renders setup CTA with integration but no configs', async function () {
    MockApiClient.addMockResponse({
      url: `/projects/${org.slug}/${project.slug}/stacktrace-link/`,
      query: {file: frame.filename, commitId: 'master', platform},
      body: {config: null, sourceUrl: null, integrations: [integration]},
    });
    render(
      <StacktraceLink frame={frame} event={event} line="foo()" lineNo={frame.lineNo} />,
      {context: TestStubs.routerContext()}
    );
    expect(
      await screen.findByText('Tell us where your source code is')
    ).toBeInTheDocument();
  });

  it('renders source url link', async function () {
    MockApiClient.addMockResponse({
      url: `/projects/${org.slug}/${project.slug}/stacktrace-link/`,
      query: {file: frame.filename, commitId: 'master', platform},
      body: {config, sourceUrl: 'https://something.io', integrations: [integration]},
    });
    render(
      <StacktraceLink frame={frame} event={event} line="foo()" lineNo={frame.lineNo} />,
      {context: TestStubs.routerContext()}
    );
    expect(await screen.findByRole('link')).toHaveAttribute(
      'href',
      'https://something.io#L233'
    );
    expect(screen.getByText('Open this line in GitHub')).toBeInTheDocument();
  });

  it('displays fix modal on error', async function () {
    MockApiClient.addMockResponse({
      url: `/projects/${org.slug}/${project.slug}/stacktrace-link/`,
      query: {file: frame.filename, commitId: 'master', platform},
      body: {
        config,
        sourceUrl: null,
        integrations: [integration],
      },
    });
    render(
      <StacktraceLink frame={frame} event={event} line="foo()" lineNo={frame.lineNo} />,
      {context: TestStubs.routerContext()}
    );
    expect(
      await screen.findByRole('button', {
        name: 'Tell us where your source code is',
      })
    ).toBeInTheDocument();
  });

  it('should hide stacktrace link error state on minified javascript frames', async function () {
    MockApiClient.addMockResponse({
      url: `/projects/${org.slug}/${project.slug}/stacktrace-link/`,
      query: {file: frame.filename, commitId: 'master', platform},
      body: {
        config,
        sourceUrl: null,
        integrations: [integration],
      },
    });
    const {container} = render(
      <StacktraceLink
        frame={frame}
        event={{...event, platform: 'javascript'}}
        line="{snip} somethingInsane=e.IsNotFound {snip}"
        lineNo={frame.lineNo}
      />,
      {context: TestStubs.routerContext()}
    );
    await waitFor(() => {
      expect(container).toBeEmptyDOMElement();
    });
  });
});
