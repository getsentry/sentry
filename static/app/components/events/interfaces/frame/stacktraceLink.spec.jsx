import {render, screen} from 'sentry-test/reactTestingLibrary';

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

  beforeEach(function () {
    MockApiClient.clearMockResponses();
    MockApiClient.addMockResponse({
      method: 'GET',
      url: '/prompts-activity/',
      body: {},
    });
  });

  it('renders setup CTA with integration but no configs', async function () {
    MockApiClient.addMockResponse({
      url: `/projects/${org.slug}/${project.slug}/stacktrace-link/`,
      query: {file: frame.filename, commitId: 'master', platform},
      body: {config: null, sourceUrl: null, integrations: [integration]},
    });
    render(
      <StacktraceLink
        frame={frame}
        event={event}
        projects={[project]}
        organization={org}
        lineNo={frame.lineNo}
      />,
      {context: TestStubs.routerContext()}
    );
    expect(
      await screen.findByText('Fix code mapping to see suspect commits and more')
    ).toBeInTheDocument();
  });

  it('renders source url link', function () {
    MockApiClient.addMockResponse({
      url: `/projects/${org.slug}/${project.slug}/stacktrace-link/`,
      query: {file: frame.filename, commitId: 'master', platform},
      body: {config, sourceUrl: 'https://something.io', integrations: [integration]},
    });
    render(
      <StacktraceLink
        frame={frame}
        event={event}
        projects={[project]}
        organization={org}
        lineNo={frame.lineNo}
      />,
      {context: TestStubs.routerContext()}
    );
    expect(screen.getByRole('link')).toHaveAttribute('href', 'https://something.io#L233');
    expect(screen.getByText('Open this line in GitHub')).toBeInTheDocument();
  });

  it('displays fix modal on error', function () {
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
      <StacktraceLink
        frame={frame}
        event={event}
        projects={[project]}
        organization={org}
        lineNo={frame.lineNo}
      />,
      {context: TestStubs.routerContext()}
    );
    expect(
      screen.getByRole('button', {
        name: 'Fix code mapping to see suspect commits and more',
      })
    ).toBeInTheDocument();
  });
});
