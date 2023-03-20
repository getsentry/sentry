import {render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

import ProjectsStore from 'sentry/stores/projectsStore';
import {CodecovStatusCode, Frame} from 'sentry/types';
import * as analytics from 'sentry/utils/integrationUtil';

import {StacktraceLink} from './stacktraceLink';

describe('StacktraceLink', function () {
  const org = TestStubs.Organization();
  const platform = 'python';
  const project = TestStubs.Project({});
  const event = TestStubs.Event({
    projectID: project.id,
    release: TestStubs.Release({lastCommit: TestStubs.Commit()}),
    platform,
  });
  const integration = TestStubs.GitHubIntegration();
  const repo = TestStubs.Repository({integrationId: integration.id});

  const frame = {filename: '/sentry/app.py', lineNo: 233} as Frame;
  const config = TestStubs.RepositoryProjectPathConfig({project, repo, integration});
  let promptActivity: jest.Mock;

  const analyticsSpy = jest.spyOn(analytics, 'trackIntegrationAnalytics');

  beforeEach(function () {
    jest.clearAllMocks();
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
      body: {config: null, sourceUrl: null, integrations: []},
    });
    render(<StacktraceLink frame={frame} event={event} line="" />, {
      context: TestStubs.routerContext(),
    });
    expect(
      await screen.findByText(
        'Add the GitHub or GitLab integration to jump straight to your source code'
      )
    ).toBeInTheDocument();
    expect(stacktraceLinkMock).toHaveBeenCalledTimes(1);
    expect(stacktraceLinkMock).toHaveBeenCalledWith(
      `/projects/${org.slug}/${project.slug}/stacktrace-link/`,
      expect.objectContaining({
        query: {
          commitId: event.release?.lastCommit?.id,
          file: frame.filename,
          platform,
          lineNo: frame.lineNo,
        },
      })
    );
    expect(promptActivity).toHaveBeenCalledTimes(1);
    expect(promptActivity).toHaveBeenCalledWith(
      '/prompts-activity/',
      expect.objectContaining({
        query: {
          feature: 'stacktrace_link',
          organization_id: org.id,
          project_id: project.id,
        },
      })
    );
  });

  it('can dismiss stacktrace link CTA', async function () {
    MockApiClient.addMockResponse({
      url: `/projects/${org.slug}/${project.slug}/stacktrace-link/`,
      body: {config: null, sourceUrl: null, integrations: []},
    });
    const dismissPrompt = MockApiClient.addMockResponse({
      method: 'PUT',
      url: `/prompts-activity/`,
      body: {},
    });
    const {container} = render(<StacktraceLink frame={frame} event={event} line="" />, {
      context: TestStubs.routerContext(),
    });
    expect(
      await screen.findByText(
        'Add the GitHub or GitLab integration to jump straight to your source code'
      )
    ).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button'));

    await waitFor(() => {
      expect(container).toBeEmptyDOMElement();
    });

    expect(dismissPrompt).toHaveBeenCalledWith(
      `/prompts-activity/`,
      expect.objectContaining({
        data: {
          feature: 'stacktrace_link',
          status: 'dismissed',
          organization_id: org.id,
          project_id: project.id,
        },
      })
    );
  });

  it('renders setup CTA with integration but no configs', async function () {
    MockApiClient.addMockResponse({
      url: `/projects/${org.slug}/${project.slug}/stacktrace-link/`,
      body: {config: null, sourceUrl: null, integrations: [integration]},
    });
    render(<StacktraceLink frame={frame} event={event} line="foo()" />, {
      context: TestStubs.routerContext(),
    });
    expect(
      await screen.findByText('Tell us where your source code is')
    ).toBeInTheDocument();
  });

  it('renders source url link', async function () {
    MockApiClient.addMockResponse({
      url: `/projects/${org.slug}/${project.slug}/stacktrace-link/`,
      body: {config, sourceUrl: 'https://something.io', integrations: [integration]},
    });
    render(<StacktraceLink frame={frame} event={event} line="foo()" />, {
      context: TestStubs.routerContext(),
    });
    expect(await screen.findByRole('link')).toHaveAttribute(
      'href',
      'https://something.io#L233'
    );
    expect(screen.getByText('Open this line in GitHub')).toBeInTheDocument();
  });

  it('displays fix modal on error', async function () {
    MockApiClient.addMockResponse({
      url: `/projects/${org.slug}/${project.slug}/stacktrace-link/`,
      body: {
        config,
        sourceUrl: null,
        integrations: [integration],
      },
    });
    render(<StacktraceLink frame={frame} event={event} line="foo()" />, {
      context: TestStubs.routerContext(),
    });
    expect(
      await screen.findByRole('button', {
        name: 'Tell us where your source code is',
      })
    ).toBeInTheDocument();
  });

  it('should hide stacktrace link error state on minified javascript frames', async function () {
    MockApiClient.addMockResponse({
      url: `/projects/${org.slug}/${project.slug}/stacktrace-link/`,
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
      />,
      {context: TestStubs.routerContext()}
    );
    await waitFor(() => {
      expect(container).toBeEmptyDOMElement();
    });
  });

  it('should hide stacktrace link error state on unsupported platforms', async function () {
    MockApiClient.addMockResponse({
      url: `/projects/${org.slug}/${project.slug}/stacktrace-link/`,
      body: {
        config,
        sourceUrl: null,
        integrations: [integration],
      },
    });
    const {container} = render(
      <StacktraceLink frame={frame} event={{...event, platform: 'unreal'}} line="" />,
      {context: TestStubs.routerContext()}
    );
    await waitFor(() => {
      expect(container).toBeEmptyDOMElement();
    });
  });

  it('renders the codecov link', async function () {
    const organization = {
      ...org,
      features: ['codecov-stacktrace-integration'],
      codecovAccess: true,
    };
    MockApiClient.addMockResponse({
      url: `/projects/${org.slug}/${project.slug}/stacktrace-link/`,
      body: {
        config,
        sourceUrl: 'https://github.com/username/path/to/file.py',
        integrations: [integration],
        codecov: {
          status: CodecovStatusCode.COVERAGE_EXISTS,
          lineCoverage: [[233, 0]],
          coverageUrl: 'https://app.codecov.io/gh/path/to/file.py',
        },
      },
    });
    render(<StacktraceLink frame={frame} event={event} line="foo()" />, {
      context: TestStubs.routerContext(),
      organization,
    });

    expect(await screen.findByText('Open in Codecov')).toHaveAttribute(
      'href',
      'https://app.codecov.io/gh/path/to/file.py#L233'
    );

    await userEvent.click(await screen.findByText('Open in Codecov'));
    expect(analyticsSpy).toHaveBeenCalledWith(
      'integrations.stacktrace_codecov_link_clicked',
      expect.anything()
    );
  });

  it('renders the missing coverage warning', async function () {
    const organization = {
      ...org,
      features: ['codecov-stacktrace-integration'],
      codecovAccess: true,
    };
    MockApiClient.addMockResponse({
      url: `/projects/${org.slug}/${project.slug}/stacktrace-link/`,
      body: {
        config,
        sourceUrl: 'https://github.com/username/path/to/file.py',
        integrations: [integration],
        codecov: {status: CodecovStatusCode.NO_COVERAGE_DATA},
      },
    });
    render(<StacktraceLink frame={frame} event={event} line="foo()" />, {
      context: TestStubs.routerContext(),
      organization,
    });
    expect(await screen.findByText('Code Coverage not found')).toBeInTheDocument();
  });

  it('renders the codecov prompt', async function () {
    const organization = {
      ...org,
      features: ['codecov-integration', 'codecov-stacktrace-integration-v2'],
      codecovAccess: false,
    };
    MockApiClient.addMockResponse({
      url: `/projects/${org.slug}/${project.slug}/stacktrace-link/`,
      body: {
        config,
        sourceUrl: 'https://github.com/username/path/to/file.py',
        integrations: [integration],
      },
    });
    render(<StacktraceLink frame={frame} event={event} line="foo()" />, {
      context: TestStubs.routerContext(),
      organization,
    });
    expect(await screen.findByText('Add Codecov test coverage')).toBeInTheDocument();
  });
});
