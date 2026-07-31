import {CommitFixture} from 'sentry-fixture/commit';
import {EventFixture} from 'sentry-fixture/event';
import {GitHubIntegrationFixture} from 'sentry-fixture/githubIntegration';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {ProjectFixture} from 'sentry-fixture/project';
import {ReleaseFixture} from 'sentry-fixture/release';
import {RepositoryFixture} from 'sentry-fixture/repository';
import {RepositoryProjectPathConfigFixture} from 'sentry-fixture/repositoryProjectPathConfig';

import {render, screen, waitFor} from 'sentry-test/reactTestingLibrary';

import {ProjectsStore} from 'sentry/stores/projectsStore';
import type {Frame} from 'sentry/types/event';

import {StacktraceLink} from './stacktraceLink';

describe('StacktraceLink', () => {
  const org = OrganizationFixture();
  const platform = 'python';
  const project = ProjectFixture();
  const event = EventFixture({
    projectID: project.id,
    release: ReleaseFixture({lastCommit: CommitFixture()}),
    platform,
  });
  const integration = GitHubIntegrationFixture();
  const repo = RepositoryFixture({integrationId: integration.id});

  const frame = {filename: '/sentry/app.py', lineNo: 233, inApp: true} as Frame;
  const config = RepositoryProjectPathConfigFixture({project, repo, integration});

  beforeEach(() => {
    jest.clearAllMocks();
    MockApiClient.clearMockResponses();
    ProjectsStore.loadInitialData([project]);
  });

  it('renders setup CTA with integration but no configs', async () => {
    MockApiClient.addMockResponse({
      url: `/projects/${org.slug}/${project.slug}/stacktrace-link/`,
      body: {config: null, sourceUrl: null, integrations: [integration]},
    });
    render(
      <StacktraceLink frame={frame} event={event} line="foo()" disableSetup={false} />
    );
    expect(await screen.findByText('Set up Code Mapping')).toBeInTheDocument();
  });

  it('renders source url link', async () => {
    MockApiClient.addMockResponse({
      url: `/projects/${org.slug}/${project.slug}/stacktrace-link/`,
      body: {config, sourceUrl: 'https://something.io', integrations: [integration]},
    });
    render(
      <StacktraceLink frame={frame} event={event} line="foo()" disableSetup={false} />
    );
    const link = await screen.findByRole('button', {name: 'Open this line in GitHub'});
    expect(link).toHaveAttribute('href', 'https://something.io#L233');
  });

  it('displays fix modal on error', async () => {
    MockApiClient.addMockResponse({
      url: `/projects/${org.slug}/${project.slug}/stacktrace-link/`,
      body: {
        config,
        sourceUrl: null,
        integrations: [integration],
      },
    });
    render(
      <StacktraceLink frame={frame} event={event} line="foo()" disableSetup={false} />
    );
    expect(await screen.findByText('Set up Code Mapping')).toBeInTheDocument();
  });

  it('should hide stacktrace link error state on minified javascript frames', async () => {
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
        disableSetup={false}
      />
    );
    await waitFor(() => {
      expect(container).toBeEmptyDOMElement();
    });
  });

  it('should show setup button for native platforms', async () => {
    MockApiClient.addMockResponse({
      url: `/projects/${org.slug}/${project.slug}/stacktrace-link/`,
      body: {
        config,
        sourceUrl: null,
        integrations: [integration],
      },
    });
    render(
      <StacktraceLink
        frame={frame}
        event={{...event, platform: 'cocoa'}}
        line=""
        disableSetup={false}
      />
    );
    expect(await screen.findByText('Set up Code Mapping')).toBeInTheDocument();
  });

  it('renders the link using a valid sourceLink for a .NET project', async () => {
    const dotnetFrame = {
      filename: 'path/to/file.py',
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
        disableSetup={false}
      />
    );
    const link = await screen.findByRole('button', {name: 'GitHub'});
    expect(link).toHaveAttribute(
      'href',
      'https://www.github.com/username/path/to/file.py#L100'
    );
  });

  it('renders in-frame stacktrace links and fetches data with 100ms delay', async () => {
    const mockRequest = MockApiClient.addMockResponse({
      url: `/projects/${org.slug}/${project.slug}/stacktrace-link/`,
      body: {config, sourceUrl: 'https://something.io', integrations: [integration]},
    });
    render(
      <StacktraceLink frame={frame} event={event} line="foo()" disableSetup={false} />
    );

    const link = await screen.findByRole('button', {name: 'Open this line in GitHub'});
    expect(link).toHaveAttribute('href', 'https://something.io#L233');
    // The link is an icon with aira label
    expect(link).toHaveTextContent('');

    expect(mockRequest).toHaveBeenCalledTimes(1);
  });

  it('does not render the setup button when disableSetup is true', async () => {
    MockApiClient.addMockResponse({
      url: `/projects/${org.slug}/${project.slug}/stacktrace-link/`,
      body: {config: null, sourceUrl: null, integrations: [integration]},
    });
    const {container} = render(
      <StacktraceLink frame={frame} event={event} line="foo()" disableSetup />
    );
    await waitFor(() => {
      expect(container).toBeEmptyDOMElement();
    });
  });
});
