import type {ComponentProps} from 'react';
import {DataScrubbingRelayPiiConfigFixture} from 'sentry-fixture/dataScrubbingRelayPiiConfig';
import {EventFixture} from 'sentry-fixture/event';
import {EventEntryStacktraceFixture} from 'sentry-fixture/eventEntryStacktrace';
import {GitHubIntegrationFixture} from 'sentry-fixture/githubIntegration';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {ProjectFixture} from 'sentry-fixture/project';

import {render, screen, userEvent, within} from 'sentry-test/reactTestingLibrary';
import {textWithMarkupMatcher} from 'sentry-test/utils';

import type {FrameSourceMapDebuggerData} from 'sentry/components/events/interfaces/sourceMapsDebuggerModal';
import {
  DisplayOptions,
  IssueStackTrace,
  StackTraceFrames,
  StackTraceProvider,
  StackTraceViewStateProvider,
  Toolbar,
} from 'sentry/components/stackTrace';
import type {StackTraceViewStateProviderProps} from 'sentry/components/stackTrace/types';
import ProjectsStore from 'sentry/stores/projectsStore';
import {CodecovStatusCode, Coverage} from 'sentry/types/integrations';
import type {
  SentryAppComponent,
  SentryAppSchemaStacktraceLink,
} from 'sentry/types/integrations';
import type {StacktraceType} from 'sentry/types/stacktrace';
import {addQueryParamsToExistingUrl} from 'sentry/utils/queryString';

type StacktraceWithFrames = StacktraceType & {
  frames: NonNullable<StacktraceType['frames']>;
};

function makeStackTraceData(): {
  event: ReturnType<typeof EventFixture>;
  stacktrace: StacktraceWithFrames;
} {
  const entry = EventEntryStacktraceFixture();

  return {
    event: EventFixture({
      platform: 'python',
      projectID: '1',
      entries: [entry],
    }),
    stacktrace: {
      ...entry.data,
      hasSystemFrames: true,
      frames:
        entry.data.frames?.map((frame, index) => ({
          ...frame,
          inApp: index >= 2,
        })) ?? [],
    } as StacktraceWithFrames,
  };
}

type TestStackTraceProviderProps = ComponentProps<typeof StackTraceProvider> &
  Pick<
    StackTraceViewStateProviderProps,
    'defaultIsMinified' | 'defaultIsNewestFirst' | 'defaultView'
  >;

function TestStackTraceProvider({
  event,
  children,
  defaultIsMinified,
  defaultIsNewestFirst,
  defaultView,
  minifiedStacktrace,
  platform,
  ...providerProps
}: TestStackTraceProviderProps) {
  return (
    <StackTraceViewStateProvider
      defaultView={defaultView}
      defaultIsNewestFirst={defaultIsNewestFirst}
      defaultIsMinified={defaultIsMinified}
      hasMinifiedStacktrace={!!minifiedStacktrace}
      platform={platform ?? event.platform}
    >
      <StackTraceProvider
        event={event}
        minifiedStacktrace={minifiedStacktrace}
        platform={platform}
        {...providerProps}
      >
        {children}
      </StackTraceProvider>
    </StackTraceViewStateProvider>
  );
}

function renderStackTrace() {
  const {event, stacktrace} = makeStackTraceData();

  render(
    <TestStackTraceProvider event={event} stacktrace={stacktrace}>
      <Toolbar />
      <StackTraceFrames />
    </TestStackTraceProvider>
  );
}

describe('Core StackTrace', () => {
  beforeEach(() => {
    MockApiClient.addMockResponse({
      url: '/projects/org-slug/project-slug/stacktrace-link/',
      body: {
        config: null,
        sourceUrl: null,
        integrations: [],
      },
    });
  });

  it('switches between app and full stack views', async () => {
    renderStackTrace();

    expect(screen.getAllByTestId('core-stacktrace-frame-row')).toHaveLength(4);

    await userEvent.click(screen.getByRole('button', {name: 'Display options'}));
    await userEvent.click(await screen.findByRole('option', {name: 'Full Stack Trace'}));

    expect(screen.getAllByTestId('core-stacktrace-frame-row')).toHaveLength(5);
  });

  it('toggles frame ordering', async () => {
    renderStackTrace();

    expect(screen.getAllByTestId('core-stacktrace-frame-title')[0]).toHaveTextContent(
      'raven/scripts/runner.py'
    );

    await userEvent.click(screen.getByRole('button', {name: 'Display options'}));
    await userEvent.click(await screen.findByRole('option', {name: 'Oldest'}));

    expect(screen.getAllByTestId('core-stacktrace-frame-title')[0]).toHaveTextContent(
      'raven/base.py'
    );
  });

  it('supports raw stack trace view', async () => {
    renderStackTrace();

    await userEvent.click(screen.getByRole('button', {name: 'Display options'}));
    await userEvent.click(await screen.findByRole('option', {name: 'Raw Stack Trace'}));

    expect(screen.getByText(/File "raven\/scripts\/runner.py"/)).toBeInTheDocument();
    expect(screen.queryByRole('list', {name: 'Stack frames'})).not.toBeInTheDocument();
  });

  it('shares display options across chained issue exceptions', async () => {
    const {event, stacktrace} = makeStackTraceData();
    render(
      <IssueStackTrace
        event={event}
        values={[
          {
            type: 'RootError',
            value: 'root cause',
            module: 'raven.base',
            mechanism: {handled: false, type: 'generic'},
            stacktrace,
            threadId: null,
            rawStacktrace: null,
          },
          {
            type: 'NestedError',
            value: 'nested cause',
            module: 'raven.scripts.runner',
            mechanism: {handled: false, type: 'generic'},
            stacktrace,
            threadId: null,
            rawStacktrace: null,
          },
        ]}
      />
    );

    expect(screen.getAllByTestId('core-stacktrace-frame-row')).toHaveLength(8);

    await userEvent.click(screen.getByRole('button', {name: 'Display options'}));
    await userEvent.click(await screen.findByRole('option', {name: 'Full Stack Trace'}));

    expect(await screen.findAllByTestId('core-stacktrace-frame-row')).toHaveLength(10);
  });

  it('toggles minified stacktrace frames when minified data is provided', async () => {
    const {event, stacktrace} = makeStackTraceData();
    const minifiedStacktrace = {
      ...stacktrace,
      frames: stacktrace.frames.map((frame, index) => ({
        ...frame,
        filename: `minified/${index}.js`,
        function: frame.rawFunction ?? `raw_fn_${index}`,
      })),
    };

    render(
      <TestStackTraceProvider
        event={event}
        stacktrace={stacktrace}
        minifiedStacktrace={minifiedStacktrace}
      >
        <Toolbar />
        <StackTraceFrames />
      </TestStackTraceProvider>
    );

    expect(screen.getAllByTestId('core-stacktrace-frame-title')[0]).toHaveTextContent(
      'raven/scripts/runner.py'
    );

    await userEvent.click(await screen.findByRole('button', {name: 'Display options'}));
    await userEvent.click(await screen.findByRole('option', {name: 'Unsymbolicated'}));

    expect(screen.getAllByTestId('core-stacktrace-frame-title')[0]).toHaveTextContent(
      'minified/4.js'
    );
  });

  it('throws when DisplayOptions renders without stack trace view state', () => {
    expect(() => render(<DisplayOptions />)).toThrow(
      'useStackTraceViewState must be used within StackTraceViewStateProvider'
    );
  });

  it('toggles frame expansion', async () => {
    renderStackTrace();

    expect(screen.getByTestId('core-stacktrace-frame-context')).toBeInTheDocument();

    await userEvent.click(screen.getAllByTestId('core-stacktrace-frame-title')[0]!);
    expect(screen.queryByTestId('core-stacktrace-frame-context')).not.toBeInTheDocument();

    await userEvent.click(screen.getAllByTestId('core-stacktrace-frame-title')[0]!);
    expect(screen.getByTestId('core-stacktrace-frame-context')).toBeInTheDocument();
  });

  it('toggles frame expansion when clicking the right trailing area', async () => {
    renderStackTrace();

    const firstTrailingArea = screen.getAllByTestId('core-stacktrace-frame-trailing')[0]!;

    expect(screen.getByTestId('core-stacktrace-frame-context')).toBeInTheDocument();
    await userEvent.click(firstTrailingArea);
    expect(screen.queryByTestId('core-stacktrace-frame-context')).not.toBeInTheDocument();
  });

  it('toggles frame expansion when clicking reserved actions slot space', async () => {
    renderStackTrace();

    const firstActionsSlot = screen.getAllByTestId(
      'core-stacktrace-frame-actions-slot'
    )[0]!;

    expect(screen.getByTestId('core-stacktrace-frame-context')).toBeInTheDocument();
    await userEvent.click(firstActionsSlot);
    expect(screen.queryByTestId('core-stacktrace-frame-context')).not.toBeInTheDocument();
  });

  it('shows and hides collapsed system frames', async () => {
    renderStackTrace();

    const toggleButton = screen.getByRole('button', {name: 'Show 1 more frames'});

    await userEvent.click(toggleButton);

    expect(screen.getAllByTestId('core-stacktrace-frame-row')).toHaveLength(5);
    expect(screen.getByRole('button', {name: 'Hide 1 frames'})).toBeInTheDocument();
  });

  it('renders frame badges for in-app frames only', async () => {
    renderStackTrace();

    expect((await screen.findAllByText('In App')).length).toBeGreaterThan(0);
    expect(screen.queryByText('System')).not.toBeInTheDocument();
  });

  it('renders captured python frame variables', async () => {
    renderStackTrace();

    expect(await screen.findByText('args')).toBeInTheDocument();
    expect(screen.getByText('dsn')).toBeInTheDocument();
  });

  it('renders coverage tooltip from issue-level coverage request', async () => {
    const {event, stacktrace} = makeStackTraceData();
    const organization = OrganizationFixture({slug: 'org-slug', codecovAccess: true});
    const project = ProjectFixture({
      id: event.projectID,
      slug: 'project-slug',
    });
    ProjectsStore.loadInitialData([project]);
    const coverageRequest = MockApiClient.addMockResponse({
      url: `/projects/${organization.slug}/${project.slug}/stacktrace-coverage/`,
      body: {
        status: CodecovStatusCode.COVERAGE_EXISTS,
        lineCoverage: [
          [110, Coverage.COVERED],
          [111, Coverage.PARTIAL],
          [112, Coverage.NOT_COVERED],
        ],
      },
    });

    render(
      <IssueStackTrace
        event={event}
        values={[
          {
            type: 'ValueError',
            value: 'list index out of range',
            module: 'raven.base',
            mechanism: {handled: false, type: 'generic'},
            stacktrace,
            threadId: null,
            rawStacktrace: null,
          },
        ]}
      />,
      {organization}
    );

    expect(
      await screen.findByTestId('core-stacktrace-frame-context')
    ).toBeInTheDocument();
    expect(coverageRequest).toHaveBeenCalled();

    await userEvent.hover(screen.getByLabelText('Line 112'));

    expect(await screen.findByText('Line uncovered by tests')).toBeInTheDocument();
  });

  it('renders variable redaction metadata like legacy frame variables', async () => {
    const {event, stacktrace} = makeStackTraceData();
    const frame = stacktrace.frames[stacktrace.frames.length - 1]!;
    const organization = OrganizationFixture();
    const project = ProjectFixture({id: event.projectID});
    const projectDetails = ProjectFixture({
      ...project,
      relayPiiConfig: JSON.stringify(DataScrubbingRelayPiiConfigFixture()),
    });
    const initialRouterConfig = {
      location: {
        pathname: `/organizations/${organization.slug}/issues/1/`,
        query: {project: project.id},
      },
      route: '/organizations/:orgId/issues/:groupId/',
    };

    ProjectsStore.loadInitialData([project]);
    MockApiClient.addMockResponse({
      url: `/projects/${organization.slug}/${project.slug}/`,
      body: projectDetails,
    });

    render(
      <TestStackTraceProvider
        event={event}
        stacktrace={{
          ...stacktrace,
          frames: [
            {
              ...frame,
              inApp: true,
              vars: {
                "'client'": '',
              },
            },
          ],
        }}
        meta={{
          frames: [
            {
              vars: {
                "'client'": {
                  '': {
                    rem: [['project:0', 's', 0, 0]],
                    len: 41,
                    chunks: [
                      {
                        type: 'redaction',
                        text: '',
                        rule_id: 'project:0',
                        remark: 's',
                      },
                    ],
                  },
                },
              },
            },
          ],
        }}
      >
        <Toolbar />
        <StackTraceFrames />
      </TestStackTraceProvider>,
      {
        organization,
        initialRouterConfig,
      }
    );

    expect(screen.getByText(/redacted/i)).toBeInTheDocument();

    await userEvent.hover(screen.getByText(/redacted/i));

    expect(
      await screen.findByText(
        textWithMarkupMatcher(
          'Replaced because of the data scrubbing rule [Replace] [Password fields] with [Scrubbed] from [password] in the settings of the project project-slug'
        )
      )
    ).toBeInTheDocument();
  });

  it('renders custom frame context via StackTraceFrames slot', async () => {
    const {event, stacktrace} = makeStackTraceData();

    function CustomFrameContext() {
      return <div data-test-id="custom-stacktrace-frame-context" />;
    }

    render(
      <TestStackTraceProvider event={event} stacktrace={stacktrace}>
        <StackTraceFrames frameContextComponent={CustomFrameContext} />
      </TestStackTraceProvider>
    );

    expect(await screen.findAllByTestId('custom-stacktrace-frame-context')).toHaveLength(
      4
    );
  });

  it('renders lead hint when non-app frame leads to app frame', async () => {
    renderStackTrace();

    expect(await screen.findByText('Called from:')).toBeInTheDocument();
  });

  it('renders crash lead hint when non-app frame has no next frame', async () => {
    const {event, stacktrace} = makeStackTraceData();
    const singleNonAppFrame = {...stacktrace.frames[0]!, inApp: false};

    render(
      <TestStackTraceProvider
        event={event}
        stacktrace={{
          ...stacktrace,
          frames: [singleNonAppFrame],
        }}
      >
        <Toolbar />
        <StackTraceFrames />
      </TestStackTraceProvider>
    );

    await userEvent.click(screen.getByTestId('core-stacktrace-frame-title'));
    expect(screen.getByText('Crashed in non-app:')).toBeInTheDocument();
  });

  it('renders stacktrace code mapping links when project data is available', async () => {
    const {event, stacktrace} = makeStackTraceData();
    const organization = OrganizationFixture();
    const project = ProjectFixture({id: event.projectID});

    ProjectsStore.loadInitialData([project]);
    MockApiClient.addMockResponse({
      url: `/projects/${organization.slug}/${project.slug}/stacktrace-link/`,
      body: {
        config: {provider: {key: 'github', name: 'GitHub'}},
        sourceUrl:
          'https://github.com/getsentry/sentry/blob/main/raven/scripts/runner.py',
        integrations: [],
      },
    });

    render(
      <TestStackTraceProvider event={event} stacktrace={stacktrace}>
        <Toolbar />
        <StackTraceFrames />
      </TestStackTraceProvider>,
      {organization}
    );

    expect(
      await screen.findByRole('button', {name: 'Open this line in GitHub'})
    ).toHaveAttribute(
      'href',
      'https://github.com/getsentry/sentry/blob/main/raven/scripts/runner.py#L112'
    );
  });

  it('renders source map info tooltip when frame map metadata exists', async () => {
    const {event, stacktrace} = makeStackTraceData();
    const frame = stacktrace.frames[stacktrace.frames.length - 1]!;

    render(
      <TestStackTraceProvider
        event={event}
        stacktrace={{
          ...stacktrace,
          frames: [
            {
              ...frame,
              inApp: true,
              origAbsPath: '/home/ubuntu/raven/scripts/runner.min.js',
              mapUrl: 'https://cdn.example.com/runner.min.js.map',
            },
          ],
        }}
      >
        <Toolbar />
        <StackTraceFrames />
      </TestStackTraceProvider>
    );

    await userEvent.hover(screen.getByTestId('core-stacktrace-frame-location'));

    expect(
      await screen.findByText('Source Map', undefined, {timeout: 2000})
    ).toBeInTheDocument();
    expect(
      await screen.findByText('https://cdn.example.com/runner.min.js.map', undefined, {
        timeout: 2000,
      })
    ).toBeInTheDocument();
  });

  it('renders unminify action when frame source map debugger data is unresolved', async () => {
    const {event, stacktrace} = makeStackTraceData();
    const frame = stacktrace.frames[stacktrace.frames.length - 1]!;

    render(
      <TestStackTraceProvider
        event={event}
        stacktrace={{
          ...stacktrace,
          frames: [
            {
              ...frame,
              filename: 'runner.min.js',
              absPath: '/home/ubuntu/runner.min.js',
              context: [],
              inApp: true,
            },
          ],
        }}
        frameSourceMapDebuggerData={[
          {frameIsResolved: false} as FrameSourceMapDebuggerData,
        ]}
      >
        <Toolbar />
        <StackTraceFrames />
      </TestStackTraceProvider>
    );

    expect(
      await screen.findByRole('button', {name: 'Unminify Code'})
    ).toBeInTheDocument();
  });

  it('renders frame badge via frameBadge prop', async () => {
    const {event, stacktrace} = makeStackTraceData();
    render(
      <TestStackTraceProvider
        event={event}
        stacktrace={stacktrace}
        frameBadge={() => <span>Custom Badge</span>}
      >
        <Toolbar />
        <StackTraceFrames />
      </TestStackTraceProvider>
    );

    expect((await screen.findAllByText('Custom Badge')).length).toBeGreaterThan(0);
  });

  it('renders sentry app frame links with line context', async () => {
    const {event, stacktrace} = makeStackTraceData();
    const components: Array<SentryAppComponent<SentryAppSchemaStacktraceLink>> = [
      {
        uuid: 'stacktrace-component',
        type: 'stacktrace-link',
        schema: {
          uri: '/frame-link',
          url: 'https://example.com/frame-link?projectSlug=sentry',
          type: 'stacktrace-link',
        },
        sentryApp: {
          uuid: 'sentry-app-1',
          slug: 'source-lens',
          name: 'Source Lens',
          avatars: [],
        },
      },
    ];

    render(
      <TestStackTraceProvider
        event={event}
        stacktrace={stacktrace}
        components={components}
      >
        <Toolbar />
        <StackTraceFrames />
      </TestStackTraceProvider>
    );

    expect(await screen.findByRole('link', {name: 'Source Lens'})).toHaveAttribute(
      'href',
      addQueryParamsToExistingUrl('https://example.com/frame-link?projectSlug=sentry', {
        filename: 'raven/scripts/runner.py',
        lineNo: 112,
      })
    );
  });

  it('shows a tooltip with absPath when hovering filename', async () => {
    const {event, stacktrace} = makeStackTraceData();
    const frameWithAbsolutePath = {
      ...stacktrace.frames[stacktrace.frames.length - 1]!,
      filename: 'raven/scripts/runner.py',
      absPath: '/home/ubuntu/raven/scripts/runner.py',
      inApp: false,
    };

    render(
      <TestStackTraceProvider
        event={event}
        stacktrace={{
          ...stacktrace,
          frames: [frameWithAbsolutePath],
        }}
      >
        <Toolbar />
        <StackTraceFrames />
      </TestStackTraceProvider>
    );

    await userEvent.hover(screen.getByTestId('core-stacktrace-frame-location'));
    expect(
      await screen.findByText('/home/ubuntu/raven/scripts/runner.py:112', undefined, {
        timeout: 2000,
      })
    ).toBeInTheDocument();
  });

  it('shows copy path and code mapping setup actions on hover for collapsed frames', async () => {
    const {event, stacktrace} = makeStackTraceData();
    const organization = OrganizationFixture();
    const project = ProjectFixture({id: event.projectID});
    const integration = GitHubIntegrationFixture();

    ProjectsStore.loadInitialData([project]);
    MockApiClient.addMockResponse({
      url: `/projects/${organization.slug}/${project.slug}/stacktrace-link/`,
      match: [MockApiClient.matchQuery({lineNo: 112})],
      body: {
        config: {provider: {key: 'github', name: 'GitHub'}},
        sourceUrl:
          'https://github.com/getsentry/sentry/blob/main/raven/scripts/runner.py',
        integrations: [],
      },
    });
    MockApiClient.addMockResponse({
      url: `/projects/${organization.slug}/${project.slug}/stacktrace-link/`,
      match: [MockApiClient.matchQuery({lineNo: 77})],
      body: {
        config: null,
        sourceUrl: null,
        integrations: [integration],
      },
    });

    render(
      <TestStackTraceProvider event={event} stacktrace={stacktrace}>
        <Toolbar />
        <StackTraceFrames />
      </TestStackTraceProvider>,
      {organization}
    );

    expect(
      screen.queryByRole('button', {name: 'Set up Code Mapping'})
    ).not.toBeInTheDocument();

    const frameTitles = screen.getAllByTestId('core-stacktrace-frame-title');
    await userEvent.hover(frameTitles[1]!);

    expect(
      await within(frameTitles[1]!).findByRole('button', {name: 'Set up Code Mapping'})
    ).toBeInTheDocument();
    expect(
      within(frameTitles[1]!).getByRole('button', {name: 'Copy file path'})
    ).toBeInTheDocument();
  });

  it('renders circular frame repeat indicator', async () => {
    const {event, stacktrace} = makeStackTraceData();
    const recursiveFrame = {
      ...stacktrace.frames[stacktrace.frames.length - 1]!,
      filename: 'raven/scripts/runner.py',
      module: 'raven.scripts.runner',
      function: 'main',
      lineNo: 112,
      inApp: true,
      package: 'raven',
      instructionAddr: '0x00000001',
    };

    render(
      <TestStackTraceProvider
        event={event}
        stacktrace={{
          ...stacktrace,
          frames: [{...recursiveFrame}, {...recursiveFrame}, {...recursiveFrame}],
        }}
      >
        <Toolbar />
        <StackTraceFrames />
      </TestStackTraceProvider>
    );

    expect(await screen.findAllByTestId('core-stacktrace-frame-row')).toHaveLength(1);
    expect(screen.getByTestId('core-stacktrace-repeats-indicator')).toHaveTextContent(
      '2'
    );
    expect(screen.getByTestId('core-stacktrace-repeats-indicator')).toHaveAttribute(
      'title',
      'Frame repeated 2 times'
    );
  });

  it('falls back to raw function and renders trimmed package in title metadata', async () => {
    const {event, stacktrace} = makeStackTraceData();
    const frame = stacktrace.frames[stacktrace.frames.length - 1]!;

    render(
      <TestStackTraceProvider
        event={event}
        stacktrace={{
          ...stacktrace,
          frames: [
            {
              ...frame,
              function: null,
              rawFunction: 'raw_runner_entrypoint',
              package: '/opt/service/releases/libpipeline.so',
              inApp: true,
            },
          ],
        }}
      >
        <Toolbar />
        <StackTraceFrames />
      </TestStackTraceProvider>
    );

    expect(await screen.findByText('raw_runner_entrypoint')).toBeInTheDocument();
    expect(screen.getByText('within')).toBeInTheDocument();
    expect(screen.getByText('/opt/service/releases/libpipeline.so')).toBeInTheDocument();
  });

  it('renders registers and .NET assembly details in expanded frame context', async () => {
    const {event, stacktrace} = makeStackTraceData();
    const frame = stacktrace.frames[stacktrace.frames.length - 1]!;

    render(
      <TestStackTraceProvider
        event={{
          ...event,
          platform: 'csharp',
          contexts: {device: {type: 'device' as const, name: '', arch: 'x86_64'}},
        }}
        stacktrace={{
          ...stacktrace,
          frames: [
            {
              ...frame,
              platform: 'csharp',
              inApp: true,
              package:
                'Acme.Worker, Version=1.2.3.4, Culture=en-US, PublicKeyToken=abc123',
            },
          ],
          registers: {
            rax: '0x0000000000000001',
            rbx: '0x0000000000000002',
            rip: '0x0000000000401000',
          },
        }}
      >
        <Toolbar />
        <StackTraceFrames />
      </TestStackTraceProvider>
    );

    expect(await screen.findByText('Registers')).toBeInTheDocument();
    expect(screen.getByText('rax')).toBeInTheDocument();
    expect(screen.getByText('Assembly:')).toBeInTheDocument();
    expect(screen.getByText('Acme.Worker')).toBeInTheDocument();
    expect(screen.getByText('PublicKeyToken:')).toBeInTheDocument();
    expect(screen.getByText('abc123')).toBeInTheDocument();
  });

  it('renders empty source notation for single frame with no details', async () => {
    const {event, stacktrace} = makeStackTraceData();
    const frame = stacktrace.frames[stacktrace.frames.length - 1]!;

    render(
      <TestStackTraceProvider
        event={event}
        stacktrace={{
          ...stacktrace,
          frames: [
            {
              ...frame,
              context: [],
              vars: null,
              package: null,
            },
          ],
          registers: {},
        }}
      >
        <Toolbar />
        <StackTraceFrames />
      </TestStackTraceProvider>
    );

    expect(
      await screen.findByText('No additional details are available for this frame.')
    ).toBeInTheDocument();
  });
});
