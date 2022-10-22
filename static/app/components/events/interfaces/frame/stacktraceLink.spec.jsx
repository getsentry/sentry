import {Event} from 'fixtures/js-stubs/event';
import {GitHubIntegration} from 'fixtures/js-stubs/gitHubIntegration';
import {Organization} from 'fixtures/js-stubs/organization';
import {Project} from 'fixtures/js-stubs/project';
import {Repository} from 'fixtures/js-stubs/repository';
import {routerContext} from 'fixtures/js-stubs/routerContext';

import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {StacktraceLink} from 'sentry/components/events/interfaces/frame/stacktraceLink';

describe('StacktraceLink', function () {
  const org = Organization();
  const project = Project();
  const event = Event({projectID: project.id});
  const integration = GitHubIntegration();
  const repo = Repository({integrationId: integration.id});

  const frame = {filename: '/sentry/app.py', lineNo: 233};
  const platform = 'python';
  const config = RepositoryProjectPathConfig({project, repo, integration});

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
      {context: routerContext()}
    );
    expect(
      await screen.findByText('Link your stack trace to your source code.')
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
      {context: routerContext()}
    );
    expect(screen.getByRole('link', {name: 'GitHub'})).toHaveAttribute(
      'href',
      'https://something.io#L233'
    );
    expect(screen.getByText('GitHub')).toBeInTheDocument();
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
    render(
      <StacktraceLink
        frame={frame}
        event={event}
        projects={[project]}
        organization={org}
        lineNo={frame.lineNo}
      />,
      {context: routerContext()}
    );
    expect(
      screen.getByRole('link', {name: 'Configure Stack Trace Linking'})
    ).toHaveAttribute(
      'href',
      '/settings/org-slug/integrations/github/1/?tab=codeMappings'
    );
    expect(screen.getByText('Source file not found.')).toBeInTheDocument();

    userEvent.hover(screen.getByLabelText('More Info'));
    expect(await screen.findByText('https://something.io/blah')).toBeInTheDocument();
  });

  it('renders stack_root_mismatch message', function () {
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
    render(
      <StacktraceLink
        frame={frame}
        event={event}
        projects={[project]}
        organization={org}
        lineNo={frame.lineNo}
      />,
      {context: routerContext()}
    );
    expect(
      screen.getByRole('link', {name: 'Configure Stack Trace Linking'})
    ).toHaveAttribute(
      'href',
      '/settings/org-slug/integrations/github/1/?tab=codeMappings'
    );
    expect(screen.getByText('Error matching your configuration.')).toBeInTheDocument();
  });

  it('renders default error message', function () {
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
      {context: routerContext()}
    );
    expect(
      screen.getByRole('link', {name: 'Configure Stack Trace Linking'})
    ).toHaveAttribute(
      'href',
      '/settings/org-slug/integrations/github/1/?tab=codeMappings'
    );
    expect(
      screen.getByText(
        'There was an error encountered with the code mapping for this project'
      )
    ).toBeInTheDocument();
  });
});
