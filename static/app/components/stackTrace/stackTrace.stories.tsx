import Panel from 'sentry/components/panels/panel';
import {StackTrace, useStackTraceContext} from 'sentry/components/stackTrace';
import * as Storybook from 'sentry/stories';
import {EventOrGroupType, type Event, type Frame} from 'sentry/types/event';
import type {
  SentryAppComponent,
  SentryAppSchemaStacktraceLink,
} from 'sentry/types/integrations';
import type {StacktraceType} from 'sentry/types/stacktrace';

type StacktraceWithFrames = StacktraceType & {
  frames: NonNullable<StacktraceType['frames']>;
};

type StackTraceStoryData = {
  event: Event;
  stacktrace: StacktraceWithFrames;
};

function makeEvent(overrides: Partial<Event> = {}): Event {
  return {
    id: '1',
    message: 'ApiException',
    title: 'ApiException',
    metadata: {},
    entries: [],
    projectID: '1',
    groupID: '1',
    eventID: '12345678901234567890123456789012',
    dateCreated: '2019-05-21T18:01:48.762Z',
    dateReceived: '2019-05-21T18:01:48.762Z',
    tags: [],
    errors: [],
    crashFile: null,
    size: 0,
    dist: null,
    fingerprints: [],
    culprit: '',
    user: null,
    location: '',
    type: EventOrGroupType.ERROR,
    occurrence: null,
    resolvedWith: [],
    contexts: {},
    ...overrides,
  } as unknown as Event;
}

function makeFrame(overrides: Partial<Frame>): Frame {
  return {
    absPath: '/home/ubuntu/raven/base.py',
    colNo: null,
    lineNo: null,
    context: [],
    filename: 'raven/base.py',
    function: 'frame_function',
    inApp: true,
    instructionAddr: '0x0000000',
    module: 'raven.base',
    package: null,
    platform: 'python',
    rawFunction: 'frame_function',
    symbol: 'frame_function',
    symbolAddr: '0x0000000',
    trust: 'none',
    vars: {},
    ...overrides,
  };
}

function makeStackTraceData(): StackTraceStoryData {
  const frames = [
    makeFrame({
      filename: 'raven/base.py',
      absPath: '/home/ubuntu/raven/base.py',
      module: 'raven.base',
      function: 'build_msg',
      context: [
        [300, '            data.update({'],
        [301, "                'sentry.interfaces.Stacktrace': {"],
        [302, "                    'frames': get_stack_info(frames),"],
      ],
      lineNo: 302,
      inApp: false,
      vars: {
        "'event_type'": "'raven.events.Message'",
        "'stack'": 'True',
        "'kwargs'": {
          "'level'": '20',
          "'message'": "'This is a test message generated using raven test'",
        },
      },
    }),
    makeFrame({
      filename: 'raven/base.py',
      absPath: '/home/ubuntu/raven/base.py',
      module: 'raven.base',
      function: 'capture',
      context: [
        [457, '        data = self.build_msg('],
        [458, '            event_type, data, date, time_spent, extra, stack, tags=tags,'],
        [459, '            **kwargs)'],
      ],
      lineNo: 459,
      inApp: false,
      vars: {
        "'data'": 'None',
        "'event_type'": "'raven.events.Message'",
        "'time_spent'": 'None',
      },
    }),
    makeFrame({
      filename: 'raven/base.py',
      absPath: '/home/ubuntu/raven/base.py',
      module: 'raven.base',
      function: 'captureMessage',
      context: [
        [575, "        >>> client.captureMessage('My event just happened!')"],
        [576, '        """'],
        [
          577,
          "        return self.capture('raven.events.Message', message=message, **kwargs)",
        ],
      ],
      lineNo: 577,
      inApp: true,
      vars: {
        "'message'": "'My event just happened!'",
        "'kwargs'": {
          "'stack'": 'True',
          "'tags'": 'None',
        },
      },
    }),
    makeFrame({
      filename: 'raven/scripts/runner.py',
      absPath: '/home/ubuntu/raven/scripts/runner.py',
      module: 'raven.scripts.runner',
      function: 'send_test_message',
      context: [
        [75, '        extra={'],
        [76, "            'user': get_uid(),"],
        [77, "            'loadavg': get_loadavg(),"],
      ],
      lineNo: 77,
      inApp: true,
      vars: {
        "'options'": {
          "'data'": 'None',
          "'tags'": 'None',
        },
      },
    }),
    makeFrame({
      filename: 'raven/scripts/runner.py',
      absPath: '/home/ubuntu/raven/scripts/runner.py',
      module: 'raven.scripts.runner',
      function: 'main',
      context: [
        [110, ''],
        [111, "    client = Client(dsn, include_paths=['raven'])"],
        [112, '    send_test_message(client, opts.__dict__)'],
      ],
      lineNo: 112,
      inApp: true,
      vars: {
        "'args'": ["'test'", "'https://public@o0.ingest.sentry.io/1'"],
        "'dsn'": "'https://public@o0.ingest.sentry.io/1'",
      },
    }),
  ];

  const stacktrace = {
    framesOmitted: null,
    hasSystemFrames: true,
    registers: {},
    frames,
  } as StacktraceWithFrames;

  const event = makeEvent({
    platform: 'python',
    projectID: '1',
    tags: [],
    entries: [],
    contexts: {},
  });

  return {event, stacktrace};
}

function makeStacktraceLinkComponents(): Array<
  SentryAppComponent<SentryAppSchemaStacktraceLink>
> {
  return [
    {
      uuid: 'stacktrace-source-link',
      type: 'stacktrace-link',
      schema: {
        uri: '/stacktrace-link',
        url: 'https://example.com/source-link?projectSlug=sentry',
        type: 'stacktrace-link',
      },
      sentryApp: {
        uuid: 'source-lens-app',
        slug: 'source-lens',
        name: 'Source Lens',
        avatars: [],
      },
    },
  ];
}

function makeCircularStackTraceData(): StackTraceStoryData {
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

  return {
    event,
    stacktrace: {
      ...stacktrace,
      frames: [{...recursiveFrame}, {...recursiveFrame}, {...recursiveFrame}],
    } as StacktraceWithFrames,
  };
}

function makeLongPathStackTraceData(): StackTraceStoryData {
  const {event, stacktrace} = makeStackTraceData();

  return {
    event,
    stacktrace: {
      ...stacktrace,
      frames: stacktrace.frames.map((frame, index) => {
        const longPath = `/workspace/teams/platform/very/deep/directory/for/customer/super/long/path/segment/${index}/src/services/handlers/production/error_processing_pipeline/frame_handler.py`;

        return {
          ...frame,
          filename: longPath,
          absPath: `/home/ubuntu${longPath}`,
          inApp: true,
        };
      }),
    } as StacktraceWithFrames,
  };
}

function makeLongPathAndFunctionStackTraceData(): StackTraceStoryData {
  const {event, stacktrace} = makeLongPathStackTraceData();

  return {
    event,
    stacktrace: {
      ...stacktrace,
      frames: stacktrace.frames.map((frame, index) => ({
        ...frame,
        function:
          `very_long_function_name_for_exception_debugging_pipeline_stage_${index}` +
          `__with_additional_context_and_nested_handler_resolution_chain`,
        inApp: true,
      })),
    } as StacktraceWithFrames,
  };
}

function makeRawFunctionAndPackageStackTraceData(): StackTraceStoryData {
  const {event, stacktrace} = makeStackTraceData();
  const firstFrame = stacktrace.frames[stacktrace.frames.length - 1];

  return {
    event,
    stacktrace: {
      ...stacktrace,
      frames: firstFrame
        ? [
            {
              ...firstFrame,
              function: null,
              rawFunction: 'raw_runner_entrypoint',
              package: '/opt/service/releases/libpipeline.so',
              inApp: true,
            },
          ]
        : [],
    } as StacktraceWithFrames,
  };
}

function makeRegistersAndAssemblyStackTraceData(): StackTraceStoryData {
  const {event, stacktrace} = makeStackTraceData();
  const frames = stacktrace.frames;
  const dotnetFrames = frames.map((frame, index) => ({
    ...frame,
    platform: 'csharp' as const,
    inApp: true,
    package:
      index === frames.length - 1
        ? 'Acme.Worker, Version=1.2.3.4, Culture=en-US, PublicKeyToken=abc123'
        : frame.package,
  }));

  return {
    event: makeEvent({
      ...event,
      platform: 'csharp',
      contexts: {device: {arch: 'x86_64'} as any},
    }),
    stacktrace: {
      ...stacktrace,
      frames: dotnetFrames,
      registers: {
        rax: '0x0000000000000001',
        rbx: '0x0000000000000002',
        rip: '0x0000000000401000',
      },
    } as StacktraceWithFrames,
  };
}

export default Storybook.story('Core/StackTrace', story => {
  story('Interactive', () => {
    const {event, stacktrace} = makeStackTraceData();

    return (
      <div>
        <StackTrace event={event} stacktrace={stacktrace}>
          <StackTrace.Toolbar />
          <StackTrace.Content />
        </StackTrace>
      </div>
    );
  });

  story('Raw View', () => {
    const {event, stacktrace} = makeStackTraceData();

    return (
      <StackTrace event={event} stacktrace={stacktrace} defaultView="raw">
        <StackTrace.Toolbar />
        <StackTrace.Content />
      </StackTrace>
    );
  });

  story('With Omitted Frames', () => {
    const {event, stacktrace} = makeStackTraceData();

    return (
      <StackTrace
        event={event}
        stacktrace={{
          ...stacktrace,
          framesOmitted: [1, 3],
        }}
      >
        <StackTrace.Toolbar />
        <StackTrace.Content />
      </StackTrace>
    );
  });

  story('With Sentry App Frame Links', () => {
    const {event, stacktrace} = makeStackTraceData();

    return (
      <StackTrace
        event={event}
        stacktrace={stacktrace}
        components={makeStacktraceLinkComponents()}
      >
        <StackTrace.Toolbar />
        <StackTrace.Content />
      </StackTrace>
    );
  });

  story('Circular Frames', () => {
    const {event, stacktrace} = makeCircularStackTraceData();

    return (
      <StackTrace event={event} stacktrace={stacktrace}>
        <StackTrace.Toolbar />
        <StackTrace.Content />
      </StackTrace>
    );
  });

  story('Long Frame Paths', () => {
    const {event, stacktrace} = makeLongPathStackTraceData();

    return (
      <StackTrace event={event} stacktrace={stacktrace}>
        <StackTrace.Toolbar />
        <StackTrace.Content />
      </StackTrace>
    );
  });

  story('Long Paths and Functions', () => {
    const {event, stacktrace} = makeLongPathAndFunctionStackTraceData();

    return (
      <StackTrace event={event} stacktrace={stacktrace}>
        <StackTrace.Toolbar />
        <StackTrace.Content />
      </StackTrace>
    );
  });

  story('Raw Function and Package', () => {
    const {event, stacktrace} = makeRawFunctionAndPackageStackTraceData();

    return (
      <StackTrace event={event} stacktrace={stacktrace}>
        <StackTrace.Toolbar />
        <StackTrace.Content />
      </StackTrace>
    );
  });

  story('Registers and Assembly', () => {
    const {event, stacktrace} = makeRegistersAndAssemblyStackTraceData();

    return (
      <StackTrace event={event} stacktrace={stacktrace}>
        <StackTrace.Toolbar />
        <StackTrace.Content />
      </StackTrace>
    );
  });

  story('Composed Frame API', () => {
    const {event, stacktrace} = makeStackTraceData();

    function ComposedContent() {
      const {rows} = useStackTraceContext();

      return (
        <Panel data-test-id="core-stacktrace-content">
          <div data-test-id="core-stacktrace-frame-list">
            {rows.map(row => {
              if (row.kind === 'omitted') {
                return (
                  <div key={row.rowKey}>
                    Frames {row.omittedFrames[0]} to {row.omittedFrames[1]} were omitted.
                  </div>
                );
              }

              return (
                <StackTrace.Frame key={row.frameIndex} row={row}>
                  <StackTrace.Frame.Header />
                  <StackTrace.Frame.Context />
                </StackTrace.Frame>
              );
            })}
          </div>
        </Panel>
      );
    }

    return (
      <StackTrace event={event} stacktrace={stacktrace}>
        <StackTrace.Toolbar />
        <ComposedContent />
      </StackTrace>
    );
  });
});
