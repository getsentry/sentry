import {Commit} from 'sentry-fixture/commit';
import {Event as EventFixture} from 'sentry-fixture/event';
import {GitHubIntegration as GitHubIntegrationFixture} from 'sentry-fixture/githubIntegration';
import {Organization} from 'sentry-fixture/organization';
import {Project as ProjectFixture} from 'sentry-fixture/project';
import {Release as ReleaseFixture} from 'sentry-fixture/release';
import {Repository} from 'sentry-fixture/repository';
import {RepositoryProjectPathConfig} from 'sentry-fixture/repositoryProjectPathConfig';
import {RouterContextFixture} from 'sentry-fixture/routerContextFixture';

import {act, render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

import HookStore from 'sentry/stores/hookStore';
import ProjectsStore from 'sentry/stores/projectsStore';
import {CodecovStatusCode, Frame} from 'sentry/types';
import * as analytics from 'sentry/utils/analytics';

import {StacktraceLink} from './stacktraceLink';

describe('StacktraceLink', function () {
  const org = Organization();
  const platform = 'python';
  const project = ProjectFixture({});
  const event = EventFixture({
    projectID: project.id,
    release: ReleaseFixture({lastCommit: Commit()}),
    platform,
  });
  const integration = GitHubIntegrationFixture();
  const repo = Repository({integrationId: integration.id});

  const frame = {filename: '/sentry/app.py', lineNo: 233} as Frame;
  const config = RepositoryProjectPathConfig({project, repo, integration});
  let promptActivity: jest.Mock;

  const analyticsSpy = jest.spyOn(analytics, 'trackAnalytics');

  beforeEach(function () {
    jest.clearAllMocks();
    MockApiClient.clearMockResponses();
    promptActivity = MockApiClient.addMockResponse({
      method: 'GET',
      url: '/prompts-activity/',
      body: {},
    });
    ProjectsStore.loadInitialData([project]);
    HookStore.init?.();
  });

  it('renders ask to setup integration', async function () {
    const stacktraceLinkMock = MockApiClient.addMockResponse({
      url: `/projects/${org.slug}/${project.slug}/stacktrace-link/`,
      body: {config: null, sourceUrl: null, integrations: []},
    });
    render(<StacktraceLink frame={frame} event={event} line="" />, {
      context: RouterContextFixture(),
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
      context: RouterContextFixture(),
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
      context: RouterContextFixture(),
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
      context: RouterContextFixture(),
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
      context: RouterContextFixture(),
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
      {context: RouterContextFixture()}
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
      {context: RouterContextFixture()}
    );
    await waitFor(() => {
      expect(container).toBeEmptyDOMElement();
    });
  });

  it('renders the codecov link', async function () {
    const organization = {
      ...org,
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
      context: RouterContextFixture(),
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
      context: RouterContextFixture(),
      organization,
    });
    expect(await screen.findByText('Code Coverage not found')).toBeInTheDocument();
  });

  it('renders the codecov prompt', async function () {
    HookStore.add(
      'component:codecov-integration-stacktrace-link',
      () =>
        function () {
          return <div data-test-id="codecov-link" />;
        }
    );
    const organization = {
      ...org,
      features: ['codecov-integration'],
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
      context: RouterContextFixture(),
      organization,
    });
    expect(await screen.findByTestId('codecov-link')).toBeInTheDocument();
  });

  it('renders the link using a valid sourceLink for a .NET project', async function () {
    const dotnetFrame = {
      sourceLink: 'https://www.github.com/username/path/to/file.py#L100',
      lineNo: '100',
    } as unknown as Frame;
    MockApiClient.addMockResponse({
      url: `/projects/${org.slug}/${project.slug}/stacktrace-link/`,
      body: {
        config,
        integrations: [integration],
      },
    });
    render(
      <StacktraceLink
        frame={dotnetFrame}
        event={{...event, platform: 'csharp'}}
        line="foo()"
      />,
      {
        context: RouterContextFixture(),
      }
    );
    expect(await screen.findByRole('link')).toHaveAttribute(
      'href',
      'https://www.github.com/username/path/to/file.py#L100'
    );
    expect(screen.getByText('Open this line in GitHub')).toBeInTheDocument();
  });

  it('renders the link using sourceUrl instead of sourceLink if it exists for a .NET project', async function () {
    const dotnetFrame = {
      sourceLink: 'https://www.github.com/source/link/url#L1',
      lineNo: '1',
    } as unknown as Frame;
    MockApiClient.addMockResponse({
      url: `/projects/${org.slug}/${project.slug}/stacktrace-link/`,
      body: {
        config,
        sourceUrl: 'https://www.github.com/url/from/code/mapping',
        integrations: [integration],
      },
    });
    render(
      <StacktraceLink
        frame={dotnetFrame}
        event={{...event, platform: 'csharp'}}
        line="foo()"
      />,
      {
        context: RouterContextFixture(),
      }
    );
    expect(await screen.findByRole('link')).toHaveAttribute(
      'href',
      'https://www.github.com/url/from/code/mapping#L1'
    );
    expect(screen.getByText('Open this line in GitHub')).toBeInTheDocument();
  });

  it('hides stacktrace link if there is no source link for .NET projects', async function () {
    MockApiClient.addMockResponse({
      url: `/projects/${org.slug}/${project.slug}/stacktrace-link/`,
      body: {
        config,
        integrations: [integration],
      },
    });
    const {container} = render(
      <StacktraceLink frame={frame} event={{...event, platform: 'csharp'}} line="" />,
      {context: RouterContextFixture()}
    );
    await waitFor(() => {
      expect(container).toBeEmptyDOMElement();
    });
  });

  it('renders in-frame stacktrace links and fetches data with 100ms delay', async function () {
    jest.useFakeTimers();
    const organization = Organization({
      features: ['issue-details-stacktrace-link-in-frame'],
    });
    const mockRequest = MockApiClient.addMockResponse({
      url: `/projects/${organization.slug}/${project.slug}/stacktrace-link/`,
      body: {config, sourceUrl: 'https://something.io', integrations: [integration]},
    });
    render(<StacktraceLink frame={frame} event={event} line="foo()" />, {
      context: RouterContextFixture([{organization}]),
      organization,
    });

    // Assert initial state (loading state)
    expect(await screen.findByTestId('loading-placeholder')).toBeInTheDocument();

    // Fast-forward time by 100ms
    act(() => {
      jest.advanceTimersByTime(100);
    });
    await waitFor(() => expect(mockRequest).toHaveBeenCalledTimes(1));

    expect(await screen.findByRole('link')).toHaveAttribute(
      'href',
      'https://something.io#L233'
    );

    expect(await screen.getByText('GitHub')).toBeInTheDocument();

    jest.useRealTimers();
  });
});
