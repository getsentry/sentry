import {DataScrubbingRelayPiiConfigFixture} from 'sentry-fixture/dataScrubbingRelayPiiConfig';
import {EventFixture} from 'sentry-fixture/event';
import {EventEntryStacktraceFixture} from 'sentry-fixture/eventEntryStacktrace';
import {GitHubIntegrationFixture} from 'sentry-fixture/githubIntegration';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {ProjectFixture} from 'sentry-fixture/project';

import {
  fireEvent,
  render,
  screen,
  userEvent,
  waitFor,
  within,
} from 'sentry-test/reactTestingLibrary';
import {textWithMarkupMatcher} from 'sentry-test/utils';

import type {FrameSourceMapDebuggerData} from 'sentry/components/events/interfaces/sourceMapsDebuggerModal';
import {
  StackTraceProvider,
  StackTraceWithCoverageData,
} from 'sentry/components/stackTrace';
import ProjectsStore from 'sentry/stores/projectsStore';
import {EntryType} from 'sentry/types/event';
import {CodecovStatusCode, Coverage} from 'sentry/types/integrations';
import type {
  LineCoverage,
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

function renderStackTrace() {
  const {event, stacktrace} = makeStackTraceData();

  render(
    <StackTraceProvider event={event} stacktrace={stacktrace}>
      <StackTraceProvider.Toolbar />
      <StackTraceProvider.Frames />
    </StackTraceProvider>
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

    const newestFirstFilenames = screen.getAllByTestId('filename');
    expect(newestFirstFilenames[0]).toHaveTextContent('raven/scripts/runner.py');

    await userEvent.click(screen.getByRole('button', {name: 'Display options'}));
    await userEvent.click(await screen.findByRole('option', {name: 'Oldest'}));

    const oldestFirstFilenames = screen.getAllByTestId('filename');
    expect(oldestFirstFilenames[0]).toHaveTextContent('raven/base.py');
  });

  it('supports raw stack trace view', async () => {
    renderStackTrace();

    await userEvent.click(screen.getByRole('button', {name: 'Display options'}));
    await userEvent.click(await screen.findByRole('option', {name: 'Raw Stack Trace'}));

    expect(screen.getByText(/File "raven\/scripts\/runner.py"/)).toBeInTheDocument();
    expect(screen.queryByTestId('core-stacktrace-frame-list')).not.toBeInTheDocument();
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
      <StackTraceProvider
        event={event}
        stacktrace={stacktrace}
        minifiedStacktrace={minifiedStacktrace}
      >
        <StackTraceProvider.Toolbar />
        <StackTraceProvider.Frames />
      </StackTraceProvider>
    );

    expect(screen.getAllByTestId('filename')[0]).toHaveTextContent(
      'raven/scripts/runner.py'
    );

    await userEvent.click(await screen.findByRole('button', {name: 'Display options'}));
    await userEvent.click(await screen.findByRole('option', {name: 'Unsymbolicated'}));

    expect(screen.getAllByTestId('filename')[0]).toHaveTextContent('minified/4.js');
  });

  it('toggles frame expansion', async () => {
    renderStackTrace();

    expect(screen.getByTestId('core-stacktrace-frame-context')).toBeInTheDocument();

    await userEvent.click(screen.getAllByTestId('core-stacktrace-frame-title')[0]!);
    expect(screen.queryByTestId('core-stacktrace-frame-context')).not.toBeInTheDocument();

    await userEvent.click(screen.getAllByTestId('core-stacktrace-frame-title')[0]!);
    expect(screen.getByTestId('core-stacktrace-frame-context')).toBeInTheDocument();
  });

  it('toggles frame expansion when clicking the chevron on the right side', async () => {
    renderStackTrace();

    const firstChevron = screen.getAllByTestId('core-stacktrace-chevron-toggle')[0]!;

    expect(screen.getByTestId('core-stacktrace-frame-context')).toBeInTheDocument();
    await userEvent.click(firstChevron);
    expect(screen.queryByTestId('core-stacktrace-frame-context')).not.toBeInTheDocument();

    await userEvent.click(firstChevron);
    expect(screen.getByTestId('core-stacktrace-frame-context')).toBeInTheDocument();
  });

  it('toggles frame expansion when clicking the chevron svg directly', async () => {
    renderStackTrace();

    const firstChevron = screen.getAllByTestId('core-stacktrace-chevron-toggle')[0]!;
    const chevronSvg = firstChevron.querySelector('svg');

    expect(chevronSvg).not.toBeNull();
    expect(screen.getByTestId('core-stacktrace-frame-context')).toBeInTheDocument();
    await userEvent.click(chevronSvg!);
    expect(screen.queryByTestId('core-stacktrace-frame-context')).not.toBeInTheDocument();
  });

  it('toggles frame expansion when pressing Enter on the chevron button', async () => {
    renderStackTrace();

    const firstChevron = screen.getAllByTestId('core-stacktrace-chevron-toggle')[0]!;

    expect(screen.getByTestId('core-stacktrace-frame-context')).toBeInTheDocument();
    firstChevron.focus();
    await userEvent.keyboard('{Enter}');
    expect(screen.queryByTestId('core-stacktrace-frame-context')).not.toBeInTheDocument();
  });

  it('toggles frame expansion when pressing Space on the chevron button', async () => {
    renderStackTrace();

    const firstChevron = (
      await screen.findAllByTestId('core-stacktrace-chevron-toggle')
    )[0]!;

    expect(screen.getByTestId('core-stacktrace-frame-context')).toBeInTheDocument();
    firstChevron.focus();
    fireEvent.keyDown(firstChevron, {key: ' ', code: 'Space'});
    fireEvent.keyUp(firstChevron, {key: ' ', code: 'Space'});
    expect(screen.queryByTestId('core-stacktrace-frame-context')).not.toBeInTheDocument();
  });

  it('wires chevron controls to the frame context region', async () => {
    renderStackTrace();

    const firstChevron = (
      await screen.findAllByTestId('core-stacktrace-chevron-toggle')
    )[0]!;
    const frameContext = screen.getByTestId('core-stacktrace-frame-context');

    expect(firstChevron).toHaveAttribute('aria-controls', frameContext.id);
    expect(firstChevron).toHaveAttribute('aria-expanded', 'true');
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

  it('renders frame badges for in-app and system frames', async () => {
    renderStackTrace();

    expect((await screen.findAllByText('In App')).length).toBeGreaterThan(0);
    expect(screen.getByText('System')).toBeInTheDocument();
  });

  it('renders captured python frame variables', async () => {
    renderStackTrace();

    expect(await screen.findByTestId('core-stacktrace-vars-grid')).toBeInTheDocument();
    expect(screen.getAllByTestId('core-stacktrace-vars-row').length).toBeGreaterThan(0);
    expect(screen.getByText('args')).toBeInTheDocument();
    expect(screen.getByText('dsn')).toBeInTheDocument();
  });

  it('renders coverage tooltip from injected frame coverage resolver', async () => {
    const {event, stacktrace} = makeStackTraceData();

    render(
      <StackTraceProvider
        event={event}
        stacktrace={stacktrace}
        getFrameLineCoverage={({frameIndex}): LineCoverage[] | undefined =>
          frameIndex === stacktrace.frames.length - 1
            ? [
                [110, Coverage.COVERED],
                [111, Coverage.PARTIAL],
                [112, Coverage.NOT_COVERED],
              ]
            : undefined
        }
      >
        <StackTraceProvider.Toolbar />
        <StackTraceProvider.Frames />
      </StackTraceProvider>
    );

    const activeLine = screen
      .getAllByTestId('core-stacktrace-frame-line-number')
      .find(node => node.textContent?.includes('112'));
    expect(activeLine).toBeDefined();

    await userEvent.hover(activeLine!);

    expect(await screen.findByText('Line uncovered by tests')).toBeInTheDocument();
  });

  it('fetches coverage only for expanded frames and reuses cached results', async () => {
    const organization = OrganizationFixture({
      codecovAccess: true,
      features: ['codecov-integration'],
    });
    const project = ProjectFixture({id: '1'});
    const {event, stacktrace} = makeStackTraceData();

    ProjectsStore.loadInitialData([project]);

    const stacktraceCoverageMock = MockApiClient.addMockResponse({
      url: `/projects/${organization.slug}/${project.slug}/stacktrace-coverage/`,
      body: {status: CodecovStatusCode.NO_COVERAGE_DATA},
    });

    const framesWithSourceContext = stacktrace.frames.map((frame, index) => {
      const lineNo = frame.lineNo ?? 100 + index;
      return {
        ...frame,
        inApp: false,
        filename: frame.filename ?? `frame-${index}.py`,
        lineNo,
        context: [
          [lineNo - 1, `frame ${index} context previous`],
          [lineNo, `frame ${index} context current`],
          [lineNo + 1, `frame ${index} context next`],
        ] as Array<[number, string]>,
      };
    });

    render(
      <StackTraceWithCoverageData
        event={{...event, projectID: project.id}}
        stacktrace={{...stacktrace, frames: framesWithSourceContext}}
        defaultView="full"
      >
        <StackTraceProvider.Toolbar />
        <StackTraceProvider.Frames />
      </StackTraceWithCoverageData>,
      {
        organization,
      }
    );

    await waitFor(() => {
      expect(stacktraceCoverageMock).toHaveBeenCalledTimes(1);
    });

    const frameTitles = screen.getAllByTestId('core-stacktrace-frame-title');
    await userEvent.click(frameTitles[1]!);

    await waitFor(() => {
      expect(stacktraceCoverageMock).toHaveBeenCalledTimes(2);
    });

    await userEvent.click(frameTitles[1]!);
    await userEvent.click(frameTitles[1]!);

    await waitFor(() => {
      expect(stacktraceCoverageMock).toHaveBeenCalledTimes(2);
    });
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
      <StackTraceProvider
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
        <StackTraceProvider.Toolbar />
        <StackTraceProvider.Frames />
      </StackTraceProvider>,
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

  it('renders lead hint when non-app frame leads to app frame', async () => {
    renderStackTrace();

    expect(await screen.findByText('Called from:')).toBeInTheDocument();
  });

  it('renders crash lead hint when non-app frame has no next frame', async () => {
    const {event, stacktrace} = makeStackTraceData();
    const singleNonAppFrame = {...stacktrace.frames[0]!, inApp: false};

    render(
      <StackTraceProvider
        event={event}
        stacktrace={{
          ...stacktrace,
          frames: [singleNonAppFrame],
        }}
      >
        <StackTraceProvider.Toolbar />
        <StackTraceProvider.Frames />
      </StackTraceProvider>
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
      <StackTraceProvider event={event} stacktrace={stacktrace}>
        <StackTraceProvider.Toolbar />
        <StackTraceProvider.Frames />
      </StackTraceProvider>,
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
      <StackTraceProvider
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
        <StackTraceProvider.Toolbar />
        <StackTraceProvider.Frames />
      </StackTraceProvider>
    );

    await userEvent.hover(screen.getByTestId('core-stacktrace-source-map-info'));

    expect(await screen.findByText('Source Map')).toBeInTheDocument();
    expect(
      await screen.findByText('https://cdn.example.com/runner.min.js.map')
    ).toBeInTheDocument();
  });

  it('renders unminify action when frame source map debugger data is unresolved', async () => {
    const {event, stacktrace} = makeStackTraceData();
    const frame = stacktrace.frames[stacktrace.frames.length - 1]!;

    render(
      <StackTraceProvider
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
        <StackTraceProvider.Toolbar />
        <StackTraceProvider.Frames />
      </StackTraceProvider>
    );

    expect(
      await screen.findByRole('button', {name: 'Unminify Code'})
    ).toBeInTheDocument();
  });

  it('renders suspect frame badge for ANR root-cause frame matches', async () => {
    const {event, stacktrace} = makeStackTraceData();
    const frame = stacktrace.frames[stacktrace.frames.length - 1]!;

    render(
      <StackTraceProvider
        event={
          {
            ...event,
            platform: 'java',
            tags: [...event.tags, {key: 'mechanism', value: 'ANR'}],
            entries: [
              ...event.entries,
              {
                type: EntryType.THREADS,
                data: {
                  values: [
                    {
                      id: 7,
                      current: true,
                      state: 'RUNNABLE',
                      crashed: false,
                      rawStacktrace: null,
                      stacktrace: null,
                    },
                  ],
                },
              },
            ],
          } as any
        }
        stacktrace={{
          ...stacktrace,
          frames: [
            {
              ...frame,
              module: 'libcore.io.Linux',
              function: 'read',
              inApp: false,
            },
          ],
        }}
        threadId={7}
      >
        <StackTraceProvider.Toolbar />
        <StackTraceProvider.Frames />
      </StackTraceProvider>
    );

    expect(await screen.findByText('Suspect Frame')).toBeInTheDocument();
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
      <StackTraceProvider event={event} stacktrace={stacktrace} components={components}>
        <StackTraceProvider.Toolbar />
        <StackTraceProvider.Frames />
      </StackTraceProvider>
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
      <StackTraceProvider
        event={event}
        stacktrace={{
          ...stacktrace,
          frames: [frameWithAbsolutePath],
        }}
      >
        <StackTraceProvider.Toolbar />
        <StackTraceProvider.Frames />
      </StackTraceProvider>
    );

    await userEvent.hover(screen.getByTestId('filename'));
    expect(
      await screen.findByText('/home/ubuntu/raven/scripts/runner.py')
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
      <StackTraceProvider event={event} stacktrace={stacktrace}>
        <StackTraceProvider.Toolbar />
        <StackTraceProvider.Frames />
      </StackTraceProvider>,
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
      <StackTraceProvider
        event={event}
        stacktrace={{
          ...stacktrace,
          frames: [{...recursiveFrame}, {...recursiveFrame}, {...recursiveFrame}],
        }}
      >
        <StackTraceProvider.Toolbar />
        <StackTraceProvider.Frames />
      </StackTraceProvider>
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
      <StackTraceProvider
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
        <StackTraceProvider.Toolbar />
        <StackTraceProvider.Frames />
      </StackTraceProvider>
    );

    expect(await screen.findByTestId('function')).toHaveTextContent(
      'raw_runner_entrypoint'
    );
    expect(screen.getByText('within')).toBeInTheDocument();
    expect(screen.getByText('libpipeline')).toBeInTheDocument();
  });

  it('renders registers and .NET assembly details in expanded frame context', async () => {
    const {event, stacktrace} = makeStackTraceData();
    const frame = stacktrace.frames[stacktrace.frames.length - 1]!;

    render(
      <StackTraceProvider
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
        <StackTraceProvider.Toolbar />
        <StackTraceProvider.Frames />
      </StackTraceProvider>
    );

    expect(
      await screen.findByTestId('core-stacktrace-frame-registers')
    ).toBeInTheDocument();
    expect(screen.getByText('Registers')).toBeInTheDocument();
    expect(screen.getByText('rax')).toBeInTheDocument();
    expect(screen.getByTestId('core-stacktrace-frame-assembly')).toBeInTheDocument();
    expect(screen.getByText('Assembly:')).toBeInTheDocument();
    expect(screen.getByText('Acme.Worker')).toBeInTheDocument();
    expect(screen.getByText('PublicKeyToken:')).toBeInTheDocument();
    expect(screen.getByText('abc123')).toBeInTheDocument();
  });

  it('renders empty source notation for single frame with no details', async () => {
    const {event, stacktrace} = makeStackTraceData();
    const frame = stacktrace.frames[stacktrace.frames.length - 1]!;

    render(
      <StackTraceProvider
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
        <StackTraceProvider.Toolbar />
        <StackTraceProvider.Frames />
      </StackTraceProvider>
    );

    expect(
      await screen.findByText('No additional details are available for this frame.')
    ).toBeInTheDocument();
  });
});
