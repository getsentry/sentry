import type {ComponentProps} from 'react';
import {DataScrubbingRelayPiiConfigFixture} from 'sentry-fixture/dataScrubbingRelayPiiConfig';
import {EventFixture} from 'sentry-fixture/event';
import {EventEntryStacktraceFixture} from 'sentry-fixture/eventEntryStacktrace';
import {GitHubIntegrationFixture} from 'sentry-fixture/githubIntegration';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {ProjectFixture} from 'sentry-fixture/project';

import {act, render, screen, userEvent, within} from 'sentry-test/reactTestingLibrary';
import {textWithMarkupMatcher} from 'sentry-test/utils';

import {DisplayOptions} from 'sentry/components/stackTrace/displayOptions';
import {FrameContent} from 'sentry/components/stackTrace/frame/frameContent';
import {IssueFrameActions} from 'sentry/components/stackTrace/issueStackTrace/issueFrameActions';
import {StackTraceViewStateProvider} from 'sentry/components/stackTrace/stackTraceContext';
import {StackTraceFrames} from 'sentry/components/stackTrace/stackTraceFrames';
import {StackTraceProvider} from 'sentry/components/stackTrace/stackTraceProvider';
import type {StackTraceViewStateProviderProps} from 'sentry/components/stackTrace/types';
import {ProjectsStore} from 'sentry/stores/projectsStore';
import {SentryAppComponentsStore} from 'sentry/stores/sentryAppComponentsStore';
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
      <DisplayOptions />
      <StackTraceFrames frameContextComponent={FrameContent} />
    </TestStackTraceProvider>
  );
}

describe('Core StackTrace', () => {
  beforeEach(() => {
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/prompts-activity/',
      body: {
        dismissed_ts: undefined,
        snoozed_ts: undefined,
      },
    });
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
        <DisplayOptions />
        <StackTraceFrames frameContextComponent={FrameContent} />
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
    expect(screen.getByTestId('core-stacktrace-frame-context')).not.toBeVisible();

    await userEvent.click(screen.getAllByTestId('core-stacktrace-frame-title')[0]!);
    expect(screen.getByTestId('core-stacktrace-frame-context')).toBeVisible();
  });

  it('toggles frame expansion when clicking the right trailing area', async () => {
    renderStackTrace();

    const firstTrailingArea = screen.getAllByTestId('core-stacktrace-frame-trailing')[0]!;

    expect(screen.getByTestId('core-stacktrace-frame-context')).toBeVisible();
    await userEvent.click(firstTrailingArea);
    expect(screen.getByTestId('core-stacktrace-frame-context')).not.toBeVisible();
  });

  it('toggles frame expansion when clicking reserved actions slot space', async () => {
    const {event, stacktrace} = makeStackTraceData();
    render(
      <TestStackTraceProvider event={event} stacktrace={stacktrace}>
        <DisplayOptions />
        <StackTraceFrames
          frameContextComponent={FrameContent}
          frameActionsComponent={IssueFrameActions}
        />
      </TestStackTraceProvider>
    );

    const firstActionsSlot = screen.getAllByTestId(
      'core-stacktrace-frame-actions-slot'
    )[0]!;

    expect(screen.getByTestId('core-stacktrace-frame-context')).toBeVisible();
    await userEvent.click(firstActionsSlot);
    expect(screen.getByTestId('core-stacktrace-frame-context')).not.toBeVisible();
  });

  it('shows and hides collapsed system frames', async () => {
    renderStackTrace();

    const toggleButton = screen.getByRole('button', {name: 'Show 1 more frame'});

    await userEvent.click(toggleButton);

    expect(screen.getAllByTestId('core-stacktrace-frame-row')).toHaveLength(5);
    expect(screen.getByRole('button', {name: 'Hide 1 frame'})).toBeInTheDocument();
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
        <DisplayOptions />
        <StackTraceFrames frameContextComponent={FrameContent} />
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
        <DisplayOptions />
        <StackTraceFrames frameContextComponent={FrameContent} />
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
        <DisplayOptions />
        <StackTraceFrames
          frameContextComponent={FrameContent}
          frameActionsComponent={IssueFrameActions}
        />
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
    jest.useFakeTimers();
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
        <DisplayOptions />
        <StackTraceFrames frameContextComponent={FrameContent} />
      </TestStackTraceProvider>
    );

    await userEvent.hover(screen.getByText('raven/scripts/runner.py'), {delay: null});
    act(() => jest.advanceTimersByTime(2000));

    expect(await screen.findByText('Source Map')).toBeInTheDocument();
    expect(
      await screen.findByText('https://cdn.example.com/runner.min.js.map')
    ).toBeInTheDocument();
    jest.useRealTimers();
  });

  it('renders unminify action when frame source map debugger data is unresolved', async () => {
    const {event, stacktrace} = makeStackTraceData();
    const javascriptEvent = EventFixture({
      ...event,
      sdk: {name: 'sentry.javascript.react', version: '10.0.0'},
    });
    const organization = OrganizationFixture({slug: 'org-slug'});
    const project = ProjectFixture({
      id: javascriptEvent.projectID,
      slug: 'project-slug',
      platform: 'javascript',
    });
    const frame = stacktrace.frames[stacktrace.frames.length - 1]!;
    ProjectsStore.loadInitialData([project]);
    MockApiClient.addMockResponse({
      url: `/projects/${organization.slug}/${project.slug}/events/${javascriptEvent.id}/source-map-debug-blue-thunder-edition/`,
      body: {
        dist: null,
        exceptions: [
          {
            frames: [
              {
                debug_id_process: {
                  debug_id: null,
                  uploaded_source_file_with_correct_debug_id: false,
                  uploaded_source_map_with_correct_debug_id: false,
                },
                release_process: null,
              },
            ],
          },
        ],
        has_debug_ids: false,
        has_uploaded_some_artifact_with_a_debug_id: false,
        project_has_some_artifact_bundle: false,
        release: null,
        release_has_some_artifact: false,
        sdk_debug_id_support: 'not-supported',
        sdk_version: '10.0.0',
      },
    });

    render(
      <TestStackTraceProvider
        event={javascriptEvent}
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
        exceptionIndex={0}
      >
        <DisplayOptions />
        <StackTraceFrames
          frameContextComponent={FrameContent}
          frameActionsComponent={IssueFrameActions}
        />
      </TestStackTraceProvider>,
      {organization}
    );

    expect(
      await screen.findByRole('button', {name: 'Unminify Code'})
    ).toBeInTheDocument();
  });

  it('renders sentry app frame links with line context', async () => {
    const {event, stacktrace} = makeStackTraceData();
    SentryAppComponentsStore.loadComponents([
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
    ]);

    render(
      <TestStackTraceProvider event={event} stacktrace={stacktrace}>
        <DisplayOptions />
        <StackTraceFrames
          frameContextComponent={FrameContent}
          frameActionsComponent={IssueFrameActions}
        />
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
    jest.useFakeTimers();
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
        <DisplayOptions />
        <StackTraceFrames frameContextComponent={FrameContent} />
      </TestStackTraceProvider>
    );

    await userEvent.hover(screen.getByText('raven/scripts/runner.py'), {delay: null});
    act(() => jest.advanceTimersByTime(2000));
    expect(
      await screen.findByText('/home/ubuntu/raven/scripts/runner.py')
    ).toBeInTheDocument();
    jest.useRealTimers();
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
        <DisplayOptions />
        <StackTraceFrames
          frameContextComponent={FrameContent}
          frameActionsComponent={IssueFrameActions}
        />
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

  it('renders a repeat tag with tooltip in frame actions', async () => {
    const {event, stacktrace} = makeStackTraceData();
    const recursiveFrame: StacktraceWithFrames['frames'][number] = {
      ...stacktrace.frames[stacktrace.frames.length - 1]!,
      inApp: true,
      package: 'raven',
      instructionAddr: '0x00000001',
    };

    render(
      <TestStackTraceProvider
        event={event}
        stacktrace={{
          ...stacktrace,
          frames: [recursiveFrame, recursiveFrame, recursiveFrame],
        }}
      >
        <DisplayOptions />
        <StackTraceFrames frameContextComponent={FrameContent} />
      </TestStackTraceProvider>
    );

    expect(await screen.findAllByTestId('core-stacktrace-frame-row')).toHaveLength(1);
    expect(screen.getByLabelText('Frame repeated 2 times')).toBeInTheDocument();
  });

  it('displays module name instead of filename for Java frames', async () => {
    const {stacktrace} = makeStackTraceData();
    const frame = stacktrace.frames[stacktrace.frames.length - 1]!;
    const event = EventFixture({
      platform: 'java',
      projectID: '1',
    });

    render(
      <TestStackTraceProvider
        event={event}
        stacktrace={{
          ...stacktrace,
          frames: [
            {
              ...frame,
              platform: 'java',
              module: 'com.example.app.MainActivity',
              filename: 'MainActivity.java',
              inApp: true,
            },
          ],
        }}
      >
        <StackTraceFrames frameContextComponent={FrameContent} />
      </TestStackTraceProvider>
    );

    expect(await screen.findByText('com.example.app.MainActivity')).toBeInTheDocument();
    expect(screen.queryByText('MainActivity.java')).not.toBeInTheDocument();
  });

  it('does not render line number when lineNo is zero', async () => {
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
              filename: 'native_module.c',
              lineNo: 0,
              colNo: 0,
              inApp: true,
            },
          ],
        }}
      >
        <StackTraceFrames frameContextComponent={FrameContent} />
      </TestStackTraceProvider>
    );

    expect(await screen.findByText('native_module.c')).toBeInTheDocument();
    expect(screen.queryByText(':0')).not.toBeInTheDocument();
    expect(screen.queryByText(':0:0')).not.toBeInTheDocument();
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
        <DisplayOptions />
        <StackTraceFrames frameContextComponent={FrameContent} />
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
          contexts: {device: {type: 'device', name: '', arch: 'x86_64'}},
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
        <DisplayOptions />
        <StackTraceFrames frameContextComponent={FrameContent} />
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
        <DisplayOptions />
        <StackTraceFrames frameContextComponent={FrameContent} />
      </TestStackTraceProvider>
    );

    expect(
      await screen.findByText('No additional details are available for this frame.')
    ).toBeInTheDocument();
  });

  it('displays full absPath URL for third-party JS frames from a different domain', async () => {
    const {stacktrace} = makeStackTraceData();
    const frame = stacktrace.frames[stacktrace.frames.length - 1]!;
    const event = EventFixture({
      platform: 'javascript',
      projectID: '1',
      tags: [{key: 'url', value: 'https://myapp.example.com/issues/123/'}],
    });

    render(
      <TestStackTraceProvider
        event={event}
        stacktrace={{
          ...stacktrace,
          frames: [
            {
              ...frame,
              absPath: 'https://cdn.thirdparty.net/js/tracker.js',
              filename: '/js/tracker.js',
              lineNo: 1,
              colNo: 1114,
              inApp: true,
            },
          ],
        }}
      >
        <StackTraceFrames frameContextComponent={FrameContent} />
      </TestStackTraceProvider>
    );

    expect(
      await screen.findByText('https://cdn.thirdparty.net/js/tracker.js')
    ).toBeInTheDocument();
  });

  it('shows URL link in tooltip when absPath is an http URL', async () => {
    jest.useFakeTimers();
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
              absPath: 'https://example.com/static/app.js',
              filename: 'app.js',
              inApp: true,
            },
          ],
        }}
      >
        <StackTraceFrames frameContextComponent={FrameContent} />
      </TestStackTraceProvider>
    );

    await userEvent.hover(screen.getByText('app.js'), {delay: null});
    act(() => jest.advanceTimersByTime(2000));

    expect(
      await screen.findByRole('link', {name: 'https://example.com/static/app.js'})
    ).toBeInTheDocument();
    jest.useRealTimers();
  });
});
