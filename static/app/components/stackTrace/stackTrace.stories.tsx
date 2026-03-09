import {Fragment} from 'react';
import styled from '@emotion/styled';

import {Flex} from '@sentry/scraps/layout';

import {Hovercard} from 'sentry/components/hovercard';
import Panel from 'sentry/components/panels/panel';
import {
  IssueStackTrace,
  StackTrace,
  StackTraceFrameRow,
  StackTraceProvider,
  StackTraceViewStateProvider,
  useStackTraceContext,
} from 'sentry/components/stackTrace';
import type {StackTraceViewStateProviderProps} from 'sentry/components/stackTrace/types';
import * as Storybook from 'sentry/stories';
import {
  EventOrGroupType,
  LockType,
  type Event,
  type ExceptionValue,
  type Frame,
} from 'sentry/types/event';
import {Coverage} from 'sentry/types/integrations';
import type {
  LineCoverage,
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
  } as Event;
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
        [298, '    def build_msg(self, event_type, data=None, date=None,'],
        [299, '                  time_spent=None, extra=None, stack=False, **kwargs):'],
        [300, '            data.update({'],
        [301, "                'sentry.interfaces.Stacktrace': {"],
        [302, "                    'frames': get_stack_info(frames),"],
        [303, '                }'],
        [304, '            })'],
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
        [455, '    def capture(self, event_type, data=None, date=None,'],
        [
          456,
          '                time_spent=None, extra=None, stack=False, tags=None, **kwargs):',
        ],
        [457, '        data = self.build_msg('],
        [458, '            event_type, data, date, time_spent, extra, stack, tags=tags,'],
        [459, '            **kwargs)'],
        [460, '        if data is None:'],
        [461, '            return None'],
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
        [573, '    def captureMessage(self, message, **kwargs):'],
        [574, '        """'],
        [575, "        >>> client.captureMessage('My event just happened!')"],
        [576, '        """'],
        [
          577,
          "        return self.capture('raven.events.Message', message=message, **kwargs)",
        ],
        [578, ''],
        [579, '    def captureException(self, exc_info=None, **kwargs):'],
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
        [73, 'def send_test_message(client, options=None):'],
        [74, '    client.captureMessage('],
        [75, '        extra={'],
        [76, "            'user': get_uid(),"],
        [77, "            'loadavg': get_loadavg(),"],
        [78, '        },'],
        [79, '    )'],
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
        [108, 'def main():'],
        [109, '    opts, args = parser.parse_args()'],
        [110, '    dsn = args[0] if args else os.environ.get("SENTRY_DSN")'],
        [111, "    client = Client(dsn, include_paths=['raven'])"],
        [112, '    send_test_message(client, opts.__dict__)'],
        [113, ''],
        [114, 'if __name__ == "__main__":'],
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
      contexts: {device: {type: 'device' as const, name: '', arch: 'x86_64'}},
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

function makeCoverageStackTraceData(): StackTraceStoryData {
  const {event, stacktrace} = makeStackTraceData();

  return {
    event,
    stacktrace: {
      ...stacktrace,
      frames: stacktrace.frames.map((frame, frameIndex) => {
        const activeLineNo = frame.lineNo ?? 100 + frameIndex * 10;
        const context = Array.from({length: 9}, (_value, contextIndex) => {
          const lineNo = activeLineNo - 4 + contextIndex;
          const isActiveLine = lineNo === activeLineNo;
          const lineText = isActiveLine
            ? `    // frame ${frameIndex + 1} active line`
            : `    // frame ${frameIndex + 1} context line ${contextIndex + 1}`;
          return [lineNo, lineText] as [number, string];
        });

        return {
          ...frame,
          context,
          lineNo: activeLineNo,
        };
      }),
    } as StacktraceWithFrames,
  };
}

function makeMixedExpandabilityStackTraceData(): StackTraceStoryData {
  return {
    event: makeEvent({
      platform: 'python',
      projectID: '1',
      tags: [],
      entries: [],
      contexts: {},
    }),
    stacktrace: {
      framesOmitted: null,
      hasSystemFrames: false,
      registers: {},
      frames: [
        makeFrame({
          filename: 'app/expandable.py',
          absPath: '/srv/app/expandable.py',
          function: 'expandable_handler',
          inApp: true,
          lineNo: 23,
          context: [
            [21, 'def expandable_handler(payload):'],
            [22, '    value = payload.get("value")'],
            [23, '    raise RuntimeError(value)'],
          ],
          vars: {"'value'": "'boom'"},
        }),
        makeFrame({
          filename: 'app/non_expandable.py',
          absPath: '/srv/app/non_expandable.py',
          function: 'non_expandable_handler',
          inApp: true,
          lineNo: null,
          context: [],
          vars: null,
          package: null,
        }),
      ],
    } as StacktraceWithFrames,
  };
}

function makeFrameCoverageResolver(
  stacktrace: StacktraceWithFrames
): ({frameIndex}: {frameIndex: number}) => LineCoverage[] | undefined {
  const coveragePattern = [Coverage.COVERED, Coverage.PARTIAL, Coverage.NOT_COVERED];

  return ({frameIndex}: {frameIndex: number}) => {
    const frame = stacktrace.frames[frameIndex];
    const context = frame?.context ?? [];

    if (context.length === 0) {
      return undefined;
    }

    return context.map(
      ([lineNo], index): LineCoverage => [
        lineNo,
        coveragePattern[index % coveragePattern.length]!,
      ]
    );
  };
}

function makeChainedExceptionValues(): ExceptionValue[] {
  return [
    {
      type: 'ValueError',
      value: 'test',
      mechanism: {handled: true, type: ''},
      stacktrace: {
        framesOmitted: null,
        hasSystemFrames: false,
        registers: null,
        frames: [
          makeFrame({
            filename: 'file1.py',
            absPath: 'file1.py',
            module: 'helpers',
            function: 'func1',
            lineNo: 50,
            context: [
              [46, 'def func1(items):'],
              [47, '    processed = []'],
              [48, '    for item in items:'],
              [49, '        value = item.get("value")'],
              [50, '        raise ValueError("test")'],
              [51, '    return processed'],
              [52, ''],
            ],
          }),
        ],
      },
      module: 'helpers',
      threadId: null,
      rawStacktrace: null,
    },
    {
      type: 'TypeError',
      value: 'nested',
      mechanism: {handled: true, type: ''},
      stacktrace: {
        framesOmitted: null,
        hasSystemFrames: false,
        registers: null,
        frames: [
          makeFrame({
            filename: 'file2.py',
            absPath: 'file2.py',
            module: 'helpers',
            function: 'func2',
            lineNo: 50,
            context: [
              [46, 'def func2(raw):'],
              [47, '    # coerce raw input to int'],
              [48, '    if not isinstance(raw, (int, str)):'],
              [49, '        pass'],
              [50, '    raise TypeError("int")'],
              [51, ''],
              [52, 'def func3():'],
            ],
          }),
        ],
      },
      module: 'helpers',
      threadId: null,
      rawStacktrace: null,
    },
    {
      type: 'RuntimeError',
      value: 'original cause',
      mechanism: {handled: true, type: ''},
      stacktrace: {
        framesOmitted: null,
        hasSystemFrames: false,
        registers: null,
        frames: [
          makeFrame({
            filename: 'file3.py',
            absPath: 'file3.py',
            module: 'helpers',
            function: 'func3',
            lineNo: 10,
            context: [
              [6, 'def func3():'],
              [7, '    conn = get_connection()'],
              [8, '    if not conn.is_alive():'],
              [9, '        conn.reconnect()'],
              [10, '    raise RuntimeError("original cause")'],
              [11, '    return conn.execute()'],
              [12, ''],
            ],
          }),
        ],
      },
      module: 'helpers',
      threadId: null,
      rawStacktrace: null,
    },
  ];
}

function makeAnrIssueStackTraceData(): {
  event: Event;
  lockAddress: string;
  values: ExceptionValue[];
} {
  const lockAddress = '0xdeadbeef';
  const frame = makeFrame({
    platform: 'java',
    module: 'android.database.sqlite.SQLiteConnection',
    function: 'nativeExecute',
    filename: 'android/database/sqlite/SQLiteConnection.java',
    inApp: false,
    lineNo: 123,
    lock: {
      type: LockType.BLOCKED,
      address: lockAddress,
      class_name: 'SQLiteConnection',
      package_name: 'android.database.sqlite',
      thread_id: 1,
    },
  });

  return {
    event: makeEvent({
      platform: 'java',
      tags: [{key: 'mechanism', value: 'ANR'}],
    }),
    lockAddress,
    values: [
      {
        type: 'ApplicationNotResponding',
        value: 'Input dispatch timed out',
        mechanism: {handled: false, type: 'ANR'},
        stacktrace: {
          framesOmitted: null,
          hasSystemFrames: true,
          registers: null,
          frames: [frame],
        },
        module: 'android.app.ActivityThread',
        threadId: 1,
        rawStacktrace: null,
      },
    ],
  };
}

type StoryStackTraceProviderProps = React.ComponentProps<typeof StackTraceProvider> &
  Pick<
    StackTraceViewStateProviderProps,
    'defaultIsMinified' | 'defaultIsNewestFirst' | 'defaultView'
  >;

function StoryStackTraceProvider({
  children,
  event,
  defaultIsMinified,
  defaultIsNewestFirst,
  defaultView,
  minifiedStacktrace,
  platform,
  ...providerProps
}: StoryStackTraceProviderProps) {
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

export default Storybook.story('StackTrace', story => {
  story('IssueStackTrace - Default', () => {
    const {event, stacktrace} = makeStackTraceData();
    return (
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
      />
    );
  });

  story('IssueStackTrace - Chained', () => {
    const values = makeChainedExceptionValues();
    return <IssueStackTrace event={makeEvent()} values={values} />;
  });

  story('IssueStackTrace - ANR Suspect Frame', () => {
    const {event, values, lockAddress} = makeAnrIssueStackTraceData();
    return <IssueStackTrace event={event} values={values} lockAddress={lockAddress} />;
  });

  story('StackTraceProvider - With Omitted Frames', () => {
    const {event, stacktrace} = makeStackTraceData();

    return (
      <Fragment>
        <p>
          When <Storybook.JSXProperty name="framesOmitted" value={[1, 3]} /> is set, a
          placeholder row appears in place of the omitted frame range.
        </p>
        <StoryStackTraceProvider
          event={event}
          stacktrace={{
            ...stacktrace,
            framesOmitted: [1, 3],
          }}
        >
          <StackTraceProvider.Frames />
        </StoryStackTraceProvider>
      </Fragment>
    );
  });

  story('StackTraceProvider - With Sentry App Frame Links', () => {
    const {event, stacktrace} = makeStackTraceData();

    return (
      <Fragment>
        <p>
          Pass <Storybook.JSXProperty name="components" value={Array} /> to inject Sentry
          App stacktrace-link components, which appear as source links on each frame.
        </p>
        <StoryStackTraceProvider
          event={event}
          stacktrace={stacktrace}
          components={makeStacktraceLinkComponents()}
        >
          <StackTraceProvider.Frames />
        </StoryStackTraceProvider>
      </Fragment>
    );
  });

  story('StackTraceProvider - Circular Frames', () => {
    const {event, stacktrace} = makeCircularStackTraceData();

    return (
      <Fragment>
        <p>
          Identical frames (same module, function, and address) are detected as recursive
          and collapsed into a single row with a repeat count badge.
        </p>
        <StoryStackTraceProvider event={event} stacktrace={stacktrace}>
          <StackTraceProvider.Frames />
        </StoryStackTraceProvider>
      </Fragment>
    );
  });

  story('StackTraceProvider - Long Frame Paths', () => {
    const {event, stacktrace} = makeLongPathStackTraceData();

    return (
      <Fragment>
        <p>
          Very long file paths are truncated with an ellipsis on the left side, preserving
          the most specific (rightmost) segments.
        </p>
        <StoryStackTraceProvider event={event} stacktrace={stacktrace}>
          <StackTraceProvider.Frames />
        </StoryStackTraceProvider>
      </Fragment>
    );
  });

  story('StackTraceProvider - Long Paths and Functions', () => {
    const {event, stacktrace} = makeLongPathAndFunctionStackTraceData();

    return (
      <Fragment>
        <p>
          Both the file path and function name are long here, testing two-column overflow.
        </p>
        <StoryStackTraceProvider event={event} stacktrace={stacktrace}>
          <StackTraceProvider.Frames />
        </StoryStackTraceProvider>
      </Fragment>
    );
  });

  story('StackTraceProvider - Raw Function and Package', () => {
    const {event, stacktrace} = makeRawFunctionAndPackageStackTraceData();

    return (
      <Fragment>
        <p>
          When <Storybook.JSXProperty name="function" value={null} /> is null and{' '}
          <Storybook.JSXProperty name="rawFunction" value="string" /> is set, the raw
          symbol is shown. A <Storybook.JSXProperty name="package" value="string" /> path
          appears as a secondary label.
        </p>
        <StoryStackTraceProvider event={event} stacktrace={stacktrace}>
          <StackTraceProvider.Frames />
        </StoryStackTraceProvider>
      </Fragment>
    );
  });

  story('StackTraceProvider - Registers and Assembly', () => {
    const {event, stacktrace} = makeRegistersAndAssemblyStackTraceData();

    return (
      <Fragment>
        <p>
          When the event has a <code>device.arch</code> context and the stacktrace has{' '}
          <Storybook.JSXProperty name="registers" value={Object} />, CPU register values
          are shown below the last frame.
        </p>
        <StoryStackTraceProvider event={event} stacktrace={stacktrace}>
          <StackTraceProvider.Frames />
        </StoryStackTraceProvider>
      </Fragment>
    );
  });

  story('StackTraceProvider - With Coverage (Multiple Frames)', () => {
    const {event, stacktrace} = makeCoverageStackTraceData();

    return (
      <Fragment>
        <p>
          Pass <Storybook.JSXProperty name="getFrameLineCoverage" value={Function} /> to
          annotate context lines with covered / partial / not-covered indicators.
        </p>
        <StoryStackTraceProvider
          event={event}
          stacktrace={stacktrace}
          getFrameLineCoverage={makeFrameCoverageResolver(stacktrace)}
        >
          <StackTraceProvider.Frames />
        </StoryStackTraceProvider>
      </Fragment>
    );
  });

  story('StackTraceProvider - Mixed Expandability Alignment', () => {
    const {event, stacktrace} = makeMixedExpandabilityStackTraceData();

    return (
      <Fragment>
        <p>
          Renders one expandable frame and one non-expandable frame so trailing actions
          stay aligned while still showing a chevron only on expandable rows.
        </p>
        <StoryStackTraceProvider event={event} stacktrace={stacktrace}>
          <StackTraceProvider.Frames />
        </StoryStackTraceProvider>
      </Fragment>
    );
  });

  story('StackTraceProvider - Composed Frame API', () => {
    const {event, stacktrace} = makeStackTraceData();

    function ComposedContent() {
      const {rows} = useStackTraceContext();

      return (
        <Panel>
          <div>
            {rows.map(row => {
              if (row.kind === 'omitted') {
                return (
                  <div key={row.rowKey}>
                    Frames {row.omittedFrames[0]} to {row.omittedFrames[1]} were omitted.
                  </div>
                );
              }

              return (
                <StackTraceFrameRow key={row.frameIndex} row={row}>
                  <StackTraceFrameRow.Header
                    actions={({isHovering}) => (
                      <StackTraceFrameRow.Actions.Default isHovering={isHovering} />
                    )}
                  />
                  <StackTraceFrameRow.Context />
                </StackTraceFrameRow>
              );
            })}
          </div>
        </Panel>
      );
    }

    return (
      <Fragment>
        <p>
          Use <Storybook.JSXNode name="useStackTraceContext" /> and{' '}
          <Storybook.JSXNode name="StackTraceFrameRow" /> to render individual frames with
          complete control over layout.
        </p>
        <StoryStackTraceProvider event={event} stacktrace={stacktrace}>
          <StackTraceProvider.Toolbar />
          <ComposedContent />
        </StoryStackTraceProvider>
      </Fragment>
    );
  });

  story('StackTraceProvider - Composed Frame Actions', () => {
    const {event, stacktrace} = makeStackTraceData();

    function ComposedActionsContent() {
      const {rows} = useStackTraceContext();

      return (
        <Panel>
          <div>
            {rows.map((row, i) => {
              if (row.kind === 'omitted') {
                return null;
              }

              if (i === 0) {
                // Default: all actions unchanged
                return (
                  <StackTraceFrameRow key={row.frameIndex} row={row}>
                    <StackTraceFrameRow.Header
                      actions={({isHovering}) => (
                        <StackTraceFrameRow.Actions.Default isHovering={isHovering} />
                      )}
                    />
                    <StackTraceFrameRow.Context />
                  </StackTraceFrameRow>
                );
              }

              if (i === 1) {
                // Custom: SourceLink + Chevron only (no source maps debugger, no hidden toggle)
                return (
                  <StackTraceFrameRow key={row.frameIndex} row={row}>
                    <StackTraceFrameRow.Header
                      actions={
                        <Fragment>
                          <StackTraceFrameRow.Actions.SourceLink />
                          <StackTraceFrameRow.Actions.Chevron />
                        </Fragment>
                      }
                    />
                    <StackTraceFrameRow.Context />
                  </StackTraceFrameRow>
                );
              }

              // Custom: extra button injected before the chevron
              return (
                <StackTraceFrameRow key={row.frameIndex} row={row}>
                  <StackTraceFrameRow.Header
                    actions={
                      <StackTraceFrameRow.Actions>
                        <StackTraceFrameRow.Actions.SourceLink />
                        <StackTraceFrameRow.Actions.SourceMapsDebugger />
                        <StackTraceFrameRow.Actions.HiddenFramesToggle />
                        <StackTraceFrameRow.Actions.Chevron />
                      </StackTraceFrameRow.Actions>
                    }
                  />
                  <StackTraceFrameRow.Context />
                </StackTraceFrameRow>
              );
            })}
          </div>
        </Panel>
      );
    }

    return (
      <Fragment>
        <p>
          Use <Storybook.JSXProperty name="actions" value="ReactNode" /> on{' '}
          <Storybook.JSXNode name="StackTraceFrameRow.Header" /> to compose exactly the
          actions you need. The first frame uses the default actions, the second uses only{' '}
          <Storybook.JSXNode name="SourceLink" /> + <Storybook.JSXNode name="Chevron" />,
          and the rest use a fully custom <Storybook.JSXNode name="Frame.Actions" />{' '}
          container.
        </p>
        <StoryStackTraceProvider event={event} stacktrace={stacktrace}>
          <ComposedActionsContent />
        </StoryStackTraceProvider>
      </Fragment>
    );
  });

  story('StackTrace - Download Button (Native + Raw)', () => {
    const {stacktrace} = makeStackTraceData();
    const event = makeEvent({platform: 'cocoa'});

    return (
      <Fragment>
        <p>
          <Storybook.JSXNode name="DownloadButton" /> appears in the toolbar when the
          platform is native (e.g. cocoa, objc, swift) and the view is set to Raw Stack
          Trace. Switch to Raw Stack Trace via the display options to see it.
        </p>
        <StoryStackTraceProvider
          event={event}
          stacktrace={stacktrace}
          platform="cocoa"
          defaultView="raw"
        >
          <Flex justify="end" align="center" gap="sm" wrap="wrap" marginBottom="sm">
            <StackTraceProvider.DownloadButton projectSlug="my-project" />
            <StackTraceProvider.DisplayOptions />
          </Flex>
          <StackTraceProvider.Frames />
        </StoryStackTraceProvider>
      </Fragment>
    );
  });

  story('StackTrace - Hovercard Preview', () => {
    const {event, stacktrace} = makeStackTraceData();

    return (
      <Flex align="center" justify="center">
        <WideHovercard
          body={
            <StoryStackTraceProvider event={event} stacktrace={stacktrace} maxDepth={5}>
              <StackTraceProvider.Frames />
            </StoryStackTraceProvider>
          }
        >
          Hovercard Trigger
        </WideHovercard>
      </Flex>
    );
  });

  story('StackTraceProvider - Minified Toggle', () => {
    const {stacktrace} = makeStackTraceData();
    const nodeEvent = makeEvent({platform: 'node'});
    const minifiedStacktrace: StacktraceWithFrames = {
      ...stacktrace,
      frames: stacktrace.frames.map(frame => ({
        ...frame,
        filename: frame.filename
          ? frame.filename.replace('.py', '.min.js')
          : frame.filename,
        function: frame.function ? `_${frame.function}` : frame.function,
      })),
    };
    return (
      <Fragment>
        <p>
          Provide <Storybook.JSXProperty name="minifiedStacktrace" value={Object} /> to
          enable the minified toggle in the Display Options (<code>···</code>) dropdown.
          The label reads <em>Minified</em> for JS/Node and <em>Unsymbolicated</em>{' '}
          elsewhere.
        </p>
        <StoryStackTraceProvider
          event={nodeEvent}
          stacktrace={stacktrace}
          minifiedStacktrace={minifiedStacktrace}
          defaultIsMinified
        >
          <StackTraceProvider.Toolbar />
          <StackTraceProvider.Frames />
        </StoryStackTraceProvider>
      </Fragment>
    );
  });

  story('StackTrace - Empty', () => {
    const event = makeEvent({platform: 'python'});
    const stacktrace: StacktraceWithFrames = {
      framesOmitted: null,
      hasSystemFrames: false,
      registers: {},
      frames: [],
    };
    return (
      <Fragment>
        <p>
          An empty frames array renders a placeholder indicating no frames are available.
        </p>
        <StackTrace event={event} stacktrace={stacktrace} />
      </Fragment>
    );
  });
});

// Mirrors the GroupPreviewHovercard pattern: className controls the body styles,
// so we need an intermediary to forward className → bodyClassName.
function WideHovercardBase({className, ...rest}: React.ComponentProps<typeof Hovercard>) {
  return <StyledWideHovercard bodyClassName={className} {...rest} />;
}

const StyledWideHovercard = styled(Hovercard)`
  width: 700px;
`;

const WideHovercard = styled(WideHovercardBase)`
  padding: 0;
`;
