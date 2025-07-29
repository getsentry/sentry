import {CommitFixture} from 'sentry-fixture/commit';
import {EventFixture} from 'sentry-fixture/event';
import {GitHubIntegrationFixture} from 'sentry-fixture/githubIntegration';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {ProjectFixture} from 'sentry-fixture/project';
import {ReleaseFixture} from 'sentry-fixture/release';
import {RepositoryFixture} from 'sentry-fixture/repository';
import {RepositoryProjectPathConfigFixture} from 'sentry-fixture/repositoryProjectPathConfig';

import {render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

import {addErrorMessage, addSuccessMessage} from 'sentry/actionCreators/indicator';
import HookStore from 'sentry/stores/hookStore';
import ProjectsStore from 'sentry/stores/projectsStore';
import type {Frame} from 'sentry/types/event';
import {CodecovStatusCode} from 'sentry/types/integrations';
import * as analytics from 'sentry/utils/analytics';

import {StacktraceLink} from './stacktraceLink';

// Mock clipboard API
Object.assign(navigator, {
  clipboard: {
    writeText: jest.fn(),
  },
});

jest.mock('sentry/actionCreators/indicator');

describe('StacktraceLink', function () {
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

  const analyticsSpy = jest.spyOn(analytics, 'trackAnalytics');

  beforeEach(function () {
    jest.clearAllMocks();
    MockApiClient.clearMockResponses();
    ProjectsStore.loadInitialData([project]);
    HookStore.init?.();
  });

  it('renders setup CTA with integration but no configs', async function () {
    MockApiClient.addMockResponse({
      url: `/projects/${org.slug}/${project.slug}/stacktrace-link/`,
      body: {config: null, sourceUrl: null, integrations: [integration]},
    });
    render(
      <StacktraceLink frame={frame} event={event} line="foo()" disableSetup={false} />
    );
    expect(await screen.findByText('Set up Code Mapping')).toBeInTheDocument();
  });

  it('renders source url link', async function () {
    MockApiClient.addMockResponse({
      url: `/projects/${org.slug}/${project.slug}/stacktrace-link/`,
      body: {config, sourceUrl: 'https://something.io', integrations: [integration]},
    });
    render(
      <StacktraceLink frame={frame} event={event} line="foo()" disableSetup={false} />
    );
    const link = await screen.findByRole('link', {name: 'Open this line in GitHub'});
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute('href', 'https://something.io#L233');
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
    render(
      <StacktraceLink frame={frame} event={event} line="foo()" disableSetup={false} />
    );
    expect(
      await screen.findByRole('button', {name: 'Set up Code Mapping'})
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
        disableSetup={false}
      />
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
      <StacktraceLink
        frame={frame}
        event={{...event, platform: 'unreal'}}
        line=""
        disableSetup={false}
      />
    );
    await waitFor(() => {
      expect(container).toBeEmptyDOMElement();
    });
  });

  it('renders the codecov link', async function () {
    const organization = {
      ...org,
      codecovAccess: true,
      features: ['codecov-integration'],
    };
    MockApiClient.addMockResponse({
      url: `/projects/${org.slug}/${project.slug}/stacktrace-link/`,
      body: {
        config,
        sourceUrl: 'https://github.com/username/path/to/file.py',
        integrations: [integration],
      },
    });
    MockApiClient.addMockResponse({
      url: `/projects/${org.slug}/${project.slug}/stacktrace-coverage/`,
      body: {
        status: CodecovStatusCode.COVERAGE_EXISTS,
        lineCoverage: [[233, 0]],
        coverageUrl: 'https://app.codecov.io/gh/path/to/file.py',
      },
    });
    render(
      <StacktraceLink frame={frame} event={event} line="foo()" disableSetup={false} />,
      {
        organization,
      }
    );

    const link = await screen.findByRole('link', {name: 'Open in Codecov'});
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute(
      'href',
      'https://app.codecov.io/gh/path/to/file.py#L233'
    );

    await userEvent.click(link);
    expect(analyticsSpy).toHaveBeenCalledWith(
      'integrations.stacktrace_codecov_link_clicked',
      expect.anything()
    );
  });

  it('renders the missing coverage warning', async function () {
    const organization = {
      ...org,
      codecovAccess: true,
      features: ['codecov-integration'],
    };
    MockApiClient.addMockResponse({
      url: `/projects/${org.slug}/${project.slug}/stacktrace-link/`,
      body: {
        config,
        sourceUrl: 'https://github.com/username/path/to/file.py',
        integrations: [integration],
      },
    });
    MockApiClient.addMockResponse({
      url: `/projects/${org.slug}/${project.slug}/stacktrace-coverage/`,
      body: {status: CodecovStatusCode.NO_COVERAGE_DATA},
    });
    render(
      <StacktraceLink frame={frame} event={event} line="foo()" disableSetup={false} />,
      {
        organization,
      }
    );
    expect(await screen.findByText('Code Coverage not found')).toBeInTheDocument();
  });

  it('skips codecov when the feature is disabled at org level', async function () {
    const organization = {
      ...org,
      codecovAccess: false,
      features: ['codecov-integration'],
    };
    MockApiClient.addMockResponse({
      url: `/projects/${org.slug}/${project.slug}/stacktrace-link/`,
      body: {
        config,
        sourceUrl: 'https://github.com/username/path/to/file.py',
        integrations: [integration],
      },
    });
    const stacktraceCoverageMock = MockApiClient.addMockResponse({
      url: `/projects/${org.slug}/${project.slug}/stacktrace-coverage/`,
      body: {status: CodecovStatusCode.NO_COVERAGE_DATA},
    });
    render(
      <StacktraceLink frame={frame} event={event} line="foo()" disableSetup={false} />,
      {
        organization,
      }
    );
    expect(
      await screen.findByRole('link', {name: 'Open this line in GitHub'})
    ).toBeInTheDocument();
    expect(stacktraceCoverageMock).not.toHaveBeenCalled();
  });

  it('renders the link using a valid sourceLink for a .NET project', async function () {
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
    const link = await screen.findByRole('link', {name: 'GitHub'});
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute(
      'href',
      'https://www.github.com/username/path/to/file.py#L100'
    );
  });

  it('renders in-frame stacktrace links and fetches data with 100ms delay', async function () {
    const mockRequest = MockApiClient.addMockResponse({
      url: `/projects/${org.slug}/${project.slug}/stacktrace-link/`,
      body: {config, sourceUrl: 'https://something.io', integrations: [integration]},
    });
    render(
      <StacktraceLink frame={frame} event={event} line="foo()" disableSetup={false} />
    );

    const link = await screen.findByRole('link', {name: 'Open this line in GitHub'});
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute('href', 'https://something.io#L233');
    // The link is an icon with aira label
    expect(link).toHaveTextContent('');

    expect(mockRequest).toHaveBeenCalledTimes(1);
  });

  it('does not render the setup button when disableSetup is true', async function () {
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

  describe('copy file path button', function () {
    beforeEach(function () {
      jest.clearAllMocks();
      (navigator.clipboard.writeText as jest.Mock).mockResolvedValue(undefined);
    });

    it('renders copy button with source url link', async function () {
      MockApiClient.addMockResponse({
        url: `/projects/${org.slug}/${project.slug}/stacktrace-link/`,
        body: {config, sourceUrl: 'https://something.io', integrations: [integration]},
      });
      render(
        <StacktraceLink frame={frame} event={event} line="foo()" disableSetup={false} />
      );

      expect(
        await screen.findByRole('button', {name: 'Copy file path'})
      ).toBeInTheDocument();
      expect(
        await screen.findByRole('link', {name: 'Open this line in GitHub'})
      ).toBeInTheDocument();
    });

    it('renders copy button with setup CTA', async function () {
      MockApiClient.addMockResponse({
        url: `/projects/${org.slug}/${project.slug}/stacktrace-link/`,
        body: {config: null, sourceUrl: null, integrations: [integration]},
      });
      render(
        <StacktraceLink frame={frame} event={event} line="foo()" disableSetup={false} />
      );

      expect(
        await screen.findByRole('button', {name: 'Copy file path'})
      ).toBeInTheDocument();
      expect(
        await screen.findByRole('button', {name: 'Set up Code Mapping'})
      ).toBeInTheDocument();
    });

    it('renders copy button with .NET sourceLink', async function () {
      const dotnetFrame = {
        filename: 'path/to/file.py',
        sourceLink: 'https://www.github.com/username/path/to/file.py#L100',
        lineNo: '100',
      } as unknown as Frame;
      MockApiClient.addMockResponse({
        url: `/projects/${org.slug}/${project.slug}/stacktrace-link/`,
        body: {config, integrations: [integration]},
      });
      render(
        <StacktraceLink
          frame={dotnetFrame}
          event={{...event, platform: 'csharp'}}
          line="foo()"
          disableSetup={false}
        />
      );

      expect(
        await screen.findByRole('button', {name: 'Copy file path'})
      ).toBeInTheDocument();
      expect(await screen.findByRole('link', {name: 'GitHub'})).toBeInTheDocument();
    });

    it('copies file path to clipboard and shows success message', async function () {
      MockApiClient.addMockResponse({
        url: `/projects/${org.slug}/${project.slug}/stacktrace-link/`,
        body: {config, sourceUrl: 'https://something.io', integrations: [integration]},
      });
      render(
        <StacktraceLink frame={frame} event={event} line="foo()" disableSetup={false} />
      );

      const copyButton = await screen.findByRole('button', {name: 'Copy file path'});
      await userEvent.click(copyButton);

      expect(navigator.clipboard.writeText).toHaveBeenCalledWith('/sentry/app.py');
      expect(addSuccessMessage).toHaveBeenCalledWith('File path copied to clipboard');
    });

    it('tracks analytics when copy button is clicked', async function () {
      MockApiClient.addMockResponse({
        url: `/projects/${org.slug}/${project.slug}/stacktrace-link/`,
        body: {config, sourceUrl: 'https://something.io', integrations: [integration]},
      });
      render(
        <StacktraceLink frame={frame} event={event} line="foo()" disableSetup={false} />
      );

      const copyButton = await screen.findByRole('button', {name: 'Copy file path'});
      await userEvent.click(copyButton);

      expect(analyticsSpy).toHaveBeenCalledWith(
        'integrations.stacktrace_file_path_copied',
        expect.objectContaining({
          view: 'stacktrace_issue_details',
          organization: org,
          group_id: parseInt(event.groupID!, 10),
        })
      );
    });

    it('shows error message when clipboard write fails', async function () {
      (navigator.clipboard.writeText as jest.Mock).mockRejectedValue(
        new Error('Clipboard error')
      );

      MockApiClient.addMockResponse({
        url: `/projects/${org.slug}/${project.slug}/stacktrace-link/`,
        body: {config, sourceUrl: 'https://something.io', integrations: [integration]},
      });
      render(
        <StacktraceLink frame={frame} event={event} line="foo()" disableSetup={false} />
      );

      const copyButton = await screen.findByRole('button', {name: 'Copy file path'});
      await userEvent.click(copyButton);

      expect(addErrorMessage).toHaveBeenCalledWith('Failed to copy file path');
    });

    it('does not copy when frame has no filename', async function () {
      const frameWithoutFilename = {...frame, filename: null} as unknown as Frame;
      MockApiClient.addMockResponse({
        url: `/projects/${org.slug}/${project.slug}/stacktrace-link/`,
        body: {config, sourceUrl: 'https://something.io', integrations: [integration]},
      });
      render(
        <StacktraceLink
          frame={frameWithoutFilename}
          event={event}
          line="foo()"
          disableSetup={false}
        />
      );

      // Should not render copy button for frames without filename
      await waitFor(() => {
        expect(
          screen.queryByRole('button', {name: 'Copy file path'})
        ).not.toBeInTheDocument();
      });
    });
  });
});
