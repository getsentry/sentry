import {Fragment} from 'react';
import styled from '@emotion/styled';

import {Tag} from '@sentry/scraps/badge';
import {Button} from '@sentry/scraps/button';
import {Flex} from '@sentry/scraps/layout';
import {Tooltip} from '@sentry/scraps/tooltip';

import {LineCoverageLegend} from 'sentry/components/events/interfaces/crashContent/exception/lineCoverageLegend';
import {Hovercard} from 'sentry/components/hovercard';
import {Panel} from 'sentry/components/panels/panel';
import {
  ChevronAction,
  HiddenFramesToggleAction,
} from 'sentry/components/stackTrace/frame/actions';
import {FrameContent} from 'sentry/components/stackTrace/frame/frameContent';
import {StackTraceFrameRow} from 'sentry/components/stackTrace/frame/frameRow';
import {IssueStackTrace} from 'sentry/components/stackTrace/issueStackTrace';
import {
  StackTraceViewStateProvider,
  useStackTraceContext,
  useStackTraceFrameContext,
} from 'sentry/components/stackTrace/stackTraceContext';
import {StackTraceFrames} from 'sentry/components/stackTrace/stackTraceFrames';
import {StackTraceProvider} from 'sentry/components/stackTrace/stackTraceProvider';
import type {StackTraceViewStateProviderProps} from 'sentry/components/stackTrace/types';
import {IconCopy, IconGithub, IconRefresh} from 'sentry/icons';
import {t, tn} from 'sentry/locale';
import * as Storybook from 'sentry/stories';
import {
  EventOrGroupType,
  type Event,
  type ExceptionValue,
  type Frame,
} from 'sentry/types/event';
import type {
  SentryAppComponent,
  SentryAppSchemaStacktraceLink,
} from 'sentry/types/integrations';
import {Coverage} from 'sentry/types/integrations';
import type {StacktraceType} from 'sentry/types/stacktrace';

type StacktraceWithFrames = StacktraceType & {
  frames: NonNullable<StacktraceType['frames']>;
};

type StackTraceStoryData = {
  event: Event;
  stacktrace: StacktraceWithFrames;
};

function getSampleSourceLineCoverage(length: number): Coverage[] {
  return Array.from({length}, (_, index) => {
    if (index % 3 === 0) {
      return Coverage.COVERED;
    }
    if (index % 3 === 1) {
      return Coverage.NOT_COVERED;
    }
    return Coverage.PARTIAL;
  });
}

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
  const inAppRecursiveFrame = {
    ...stacktrace.frames[stacktrace.frames.length - 1]!,
    filename: 'raven/scripts/runner.py',
    module: 'raven.scripts.runner',
    function: 'main',
    lineNo: 112,
    inApp: true,
    package: 'raven',
    instructionAddr: '0x00000001',
  };
  const systemRecursiveFrame = {
    ...stacktrace.frames[stacktrace.frames.length - 1]!,
    filename: 'lib/urllib3/connectionpool.py',
    module: 'urllib3.connectionpool',
    function: '_make_request',
    lineNo: 487,
    inApp: false,
    package: 'urllib3',
    instructionAddr: '0x00000002',
  };

  return {
    event,
    stacktrace: {
      ...stacktrace,
      frames: [
        {...systemRecursiveFrame},
        {...systemRecursiveFrame},
        {...systemRecursiveFrame},
        {...inAppRecursiveFrame},
        {...inAppRecursiveFrame},
        {...inAppRecursiveFrame},
      ],
    } as StacktraceWithFrames,
  };
}

function makeSourceMapTooltipStackTraceData(): StackTraceStoryData {
  const {event, stacktrace} = makeStackTraceData();
  const lastFrame = stacktrace.frames[stacktrace.frames.length - 1]!;

  return {
    event,
    stacktrace: {
      ...stacktrace,
      frames: [
        {
          ...lastFrame,
          filename: 'raven/scripts/runner.min.js',
          absPath: '/home/ubuntu/raven/scripts/runner.min.js',
          origAbsPath: '/home/ubuntu/raven/scripts/runner.js',
          mapUrl: 'https://cdn.example.com/runner.min.js.map',
          inApp: true,
        },
      ],
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

function makeExceptionGroupValues(): ExceptionValue[] {
  return [
    {
      type: 'ExceptionGroup',
      value: '2 sub-exceptions',
      mechanism: {
        handled: true,
        type: 'BaseExceptionGroup',
        exception_id: 0,
        is_exception_group: true,
      },
      stacktrace: {
        framesOmitted: null,
        hasSystemFrames: false,
        registers: null,
        frames: [
          makeFrame({
            filename: 'app/main.py',
            absPath: 'app/main.py',
            module: 'app.main',
            function: 'run_tasks',
            lineNo: 42,
            context: [
              [40, 'def run_tasks():'],
              [41, '    errors = run_batch()'],
              [42, '    raise ExceptionGroup("2 sub-exceptions", errors)'],
            ],
          }),
        ],
      },
      module: 'app.main',
      threadId: null,
      rawStacktrace: null,
    },
    {
      type: 'ValueError',
      value: 'invalid input: expected positive integer',
      mechanism: {
        handled: true,
        type: 'BaseExceptionGroup',
        exception_id: 1,
        parent_id: 0,
      },
      stacktrace: {
        framesOmitted: null,
        hasSystemFrames: false,
        registers: null,
        frames: [
          makeFrame({
            filename: 'app/validators.py',
            absPath: 'app/validators.py',
            module: 'app.validators',
            function: 'validate_input',
            lineNo: 15,
            context: [
              [13, 'def validate_input(value):'],
              [14, '    if value < 0:'],
              [
                15,
                '        raise ValueError("invalid input: expected positive integer")',
              ],
            ],
          }),
        ],
      },
      module: 'app.validators',
      threadId: null,
      rawStacktrace: null,
    },
    {
      type: 'TypeError',
      value: "unsupported operand type(s) for +: 'int' and 'str'",
      mechanism: {
        handled: true,
        type: 'BaseExceptionGroup',
        exception_id: 2,
        parent_id: 0,
      },
      stacktrace: {
        framesOmitted: null,
        hasSystemFrames: false,
        registers: null,
        frames: [
          makeFrame({
            filename: 'app/math.py',
            absPath: 'app/math.py',
            module: 'app.math',
            function: 'add_values',
            lineNo: 7,
            context: [
              [5, 'def add_values(a, b):'],
              [6, '    # oops, b is a string'],
              [7, '    return a + b'],
            ],
          }),
        ],
      },
      module: 'app.math',
      threadId: null,
      rawStacktrace: null,
    },
  ];
}

function makeChainedWithExceptionGroupValues(): ExceptionValue[] {
  const makeGroupFrame = (filename: string, func: string, lineNo: number) =>
    makeFrame({
      filename,
      absPath: filename,
      module: 'app',
      function: func,
      lineNo,
      context: [
        [lineNo - 2, `def ${func}():`],
        [lineNo - 1, '    try:'],
        [lineNo, `        raise ExceptionGroup("group", errors)`],
        [lineNo + 1, '    except Exception:'],
        [lineNo + 2, '        pass'],
      ],
    });

  const makeSimpleStacktrace = (
    filename: string,
    func: string,
    lineNo: number
  ): ExceptionValue['stacktrace'] => ({
    framesOmitted: null,
    hasSystemFrames: false,
    registers: null,
    frames: [makeGroupFrame(filename, func, lineNo)],
  });

  return [
    // A plain chained exception (no exception_id, no tree structure)
    {
      type: 'RuntimeError',
      value: 'task runner failed',
      mechanism: {handled: true, type: 'chained'},
      stacktrace: makeSimpleStacktrace('app/runner.py', 'run', 10),
      module: 'app.runner',
      threadId: null,
      rawStacktrace: null,
    },
    // Root exception group caused by the above
    {
      type: 'ExceptionGroup',
      value: 'batch failed (2 sub-exceptions)',
      mechanism: {
        handled: true,
        type: 'chained',
        exception_id: 0,
        is_exception_group: true,
      },
      stacktrace: makeSimpleStacktrace('app/main.py', 'run_tasks', 42),
      module: 'app.main',
      threadId: null,
      rawStacktrace: null,
    },
    {
      type: 'ValueError',
      value: 'invalid input: expected positive integer',
      mechanism: {
        handled: true,
        type: 'chained',
        exception_id: 1,
        parent_id: 0,
      },
      stacktrace: makeSimpleStacktrace('app/validators.py', 'validate_input', 15),
      module: 'app.validators',
      threadId: null,
      rawStacktrace: null,
    },
    // Nested exception group — its children start hidden
    {
      type: 'ExceptionGroup',
      value: 'nested group (2 sub-exceptions)',
      mechanism: {
        handled: true,
        type: 'chained',
        exception_id: 2,
        parent_id: 0,
        is_exception_group: true,
      },
      stacktrace: makeSimpleStacktrace('app/tasks.py', 'process_batch', 88),
      module: 'app.tasks',
      threadId: null,
      rawStacktrace: null,
    },
    {
      type: 'TypeError',
      value: "unsupported operand type(s) for +: 'int' and 'str'",
      mechanism: {
        handled: true,
        type: 'chained',
        exception_id: 3,
        parent_id: 2,
      },
      stacktrace: makeSimpleStacktrace('app/math.py', 'add_values', 7),
      module: 'app.math',
      threadId: null,
      rawStacktrace: null,
    },
    {
      type: 'KeyError',
      value: "'missing_key'",
      mechanism: {
        handled: true,
        type: 'chained',
        exception_id: 4,
        parent_id: 2,
      },
      stacktrace: makeSimpleStacktrace('app/config.py', 'get_setting', 23),
      module: 'app.config',
      threadId: null,
      rawStacktrace: null,
    },
  ];
}

function StoryFrameActions({isHovering}: {isHovering: boolean}) {
  const {frame, timesRepeated, isExpanded} = useStackTraceFrameContext();
  const showHoverActions = isExpanded || isHovering;

  return (
    <Fragment>
      <HoverActionsSlot visible={showHoverActions}>
        <Tooltip title={t('Copy file path')} skipWrapper>
          <Button
            size="xs"
            priority="transparent"
            aria-label={t('Copy file path')}
            icon={<IconCopy size="xs" />}
            onClick={e => e.stopPropagation()}
          />
        </Tooltip>
        <Tooltip title={t('Open this line in GitHub')} skipWrapper>
          <Button
            size="xs"
            priority="transparent"
            aria-label={t('Open this line in GitHub')}
            icon={<IconGithub size="xs" />}
            onClick={e => e.stopPropagation()}
          />
        </Tooltip>
      </HoverActionsSlot>
      <HiddenFramesToggleAction />
      {timesRepeated > 0 ? (
        <Tooltip
          title={tn('Frame repeated %s time', 'Frame repeated %s times', timesRepeated)}
          skipWrapper
        >
          <Tag
            icon={<IconRefresh size="xs" />}
            variant="muted"
            data-test-id="core-stacktrace-repeats-tag"
          >
            {timesRepeated}
          </Tag>
        </Tooltip>
      ) : null}
      {frame.inApp ? <Tag variant="info">{t('In App')}</Tag> : null}
      <ChevronAction />
    </Fragment>
  );
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

  story('IssueStackTrace - Exception Group', () => {
    const values = makeExceptionGroupValues();
    return (
      <Fragment>
        <p>
          A single exception group (Python 3.11+) with two child exceptions. The root
          group shows a related exceptions tree with its children.
        </p>
        <IssueStackTrace event={makeEvent({platform: 'python'})} values={values} />
      </Fragment>
    );
  });

  story('IssueStackTrace - Chained + Exception Group', () => {
    const values = makeChainedWithExceptionGroupValues();
    return (
      <Fragment>
        <p>
          A flat chained exception followed by an exception group. The{' '}
          <code>RuntimeError</code> is a plain chained exception with no tree structure,
          while the <code>ExceptionGroup</code> has child exceptions with the related
          exceptions tree and toggle controls.
        </p>
        <IssueStackTrace event={makeEvent({platform: 'python'})} values={values} />
      </Fragment>
    );
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
          <StackTraceFrames
            frameContextComponent={FrameContent}
            frameActionsComponent={StoryFrameActions}
          />
        </StoryStackTraceProvider>
      </Fragment>
    );
  });

  story('StackTraceProvider - With Sentry App Frame Links', () => {
    const {event, stacktrace} = makeStackTraceData();

    return (
      <Fragment>
        <StoryStackTraceProvider
          event={event}
          stacktrace={stacktrace}
          components={makeStacktraceLinkComponents()}
        >
          <StackTraceFrames
            frameContextComponent={FrameContent}
            frameActionsComponent={StoryFrameActions}
          />
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
          <StackTraceFrames
            frameContextComponent={FrameContent}
            frameActionsComponent={StoryFrameActions}
          />
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
          <StackTraceFrames
            frameContextComponent={FrameContent}
            frameActionsComponent={StoryFrameActions}
          />
        </StoryStackTraceProvider>
      </Fragment>
    );
  });

  story('StackTraceProvider - File Path and Source Map Tooltip', () => {
    const {event, stacktrace} = makeSourceMapTooltipStackTraceData();

    return (
      <Fragment>
        <p>
          File paths use the standard <code>filename:line</code> or{' '}
          <code>filename:line:column</code> format. Hover over the path for the full
          absolute path and source map info (when{' '}
          <Storybook.JSXProperty name="origAbsPath" value="string" /> and{' '}
          <Storybook.JSXProperty name="mapUrl" value="string" /> or{' '}
          <Storybook.JSXProperty name="map" value="string" /> are set).
        </p>
        <StoryStackTraceProvider event={event} stacktrace={stacktrace}>
          <StackTraceFrames
            frameContextComponent={FrameContent}
            frameActionsComponent={StoryFrameActions}
          />
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
          <StackTraceFrames
            frameContextComponent={FrameContent}
            frameActionsComponent={StoryFrameActions}
          />
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
          <StackTraceFrames
            frameContextComponent={FrameContent}
            frameActionsComponent={StoryFrameActions}
          />
        </StoryStackTraceProvider>
      </Fragment>
    );
  });

  story('StackTraceFrames - Single Frame Source Coverage', () => {
    const {event, stacktrace} = makeStackTraceData();

    const frameWithContext = stacktrace.frames.find(
      frame => frame.inApp && (frame.context?.length ?? 0) > 0
    );
    if (!frameWithContext) {
      return null;
    }

    const sourceLineCoverage = getSampleSourceLineCoverage(
      frameWithContext.context?.length ?? 0
    );

    const singleFrameStacktrace = {
      ...stacktrace,
      frames: [frameWithContext],
    };

    function CoveredFrameContext() {
      return <FrameContent sourceLineCoverage={sourceLineCoverage} />;
    }

    return (
      <Flex direction="column" gap="md">
        <LineCoverageLegend />
        <StoryStackTraceProvider event={event} stacktrace={singleFrameStacktrace}>
          <StackTraceFrames
            frameContextComponent={CoveredFrameContext}
            frameActionsComponent={StoryFrameActions}
          />
        </StoryStackTraceProvider>
      </Flex>
    );
  });

  story('StackTraceFrames - Long Line Numbers', () => {
    const {event, stacktrace} = makeStackTraceData();

    const frameWithContext = stacktrace.frames.find(
      frame => frame.inApp && (frame.context?.length ?? 0) > 0
    );
    if (!frameWithContext) {
      return null;
    }

    const context = frameWithContext.context ?? [];
    const lineNumberOffset = 12000;
    const longLineNumberFrame = {
      ...frameWithContext,
      context: context.map<[number, string | null]>(([lineNumber, lineValue]) => [
        lineNumber + lineNumberOffset,
        lineValue,
      ]),
      lineNo:
        typeof frameWithContext.lineNo === 'number'
          ? frameWithContext.lineNo + lineNumberOffset
          : frameWithContext.lineNo,
    };

    const singleFrameStacktrace = {
      ...stacktrace,
      frames: [longLineNumberFrame],
    };

    return (
      <div>
        <StoryStackTraceProvider event={event} stacktrace={singleFrameStacktrace}>
          <StackTraceFrames
            frameContextComponent={FrameContent}
            frameActionsComponent={StoryFrameActions}
          />
        </StoryStackTraceProvider>
      </div>
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
          <StackTraceFrames
            frameContextComponent={FrameContent}
            frameActionsComponent={StoryFrameActions}
          />
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
                      <StoryFrameActions isHovering={isHovering} />
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
                return (
                  <StackTraceFrameRow key={row.frameIndex} row={row}>
                    <StackTraceFrameRow.Header
                      actions={({isHovering}) => (
                        <StoryFrameActions isHovering={isHovering} />
                      )}
                    />
                    <StackTraceFrameRow.Context />
                  </StackTraceFrameRow>
                );
              }

              if (i === 1) {
                return (
                  <StackTraceFrameRow key={row.frameIndex} row={row}>
                    <StackTraceFrameRow.Header
                      actions={
                        <Fragment>
                          <ChevronAction />
                        </Fragment>
                      }
                    />
                    <StackTraceFrameRow.Context />
                  </StackTraceFrameRow>
                );
              }

              return (
                <StackTraceFrameRow key={row.frameIndex} row={row}>
                  <StackTraceFrameRow.Header
                    actions={
                      <Fragment>
                        <HiddenFramesToggleAction />
                        <ChevronAction />
                      </Fragment>
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
          actions you need. The first frame uses all actions, the second uses only{' '}
          <Storybook.JSXNode name="Chevron" />, and the rest use{' '}
          <Storybook.JSXNode name="HiddenFramesToggle" /> +{' '}
          <Storybook.JSXNode name="Chevron" />.
        </p>
        <StoryStackTraceProvider event={event} stacktrace={stacktrace}>
          <ComposedActionsContent />
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
              <StackTraceFrames
                frameContextComponent={FrameContent}
                frameActionsComponent={StoryFrameActions}
              />
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
    const stripVars = (frames: StacktraceWithFrames['frames']) =>
      frames.map(frame => ({...frame, vars: {}}));
    const minifiedStacktrace: StacktraceWithFrames = {
      ...stacktrace,
      frames: stripVars(stacktrace.frames).map(frame => ({
        ...frame,
        filename: frame.filename
          ? frame.filename.replace('.py', '.min.js')
          : frame.filename,
        function: frame.function ? `_${frame.function}` : frame.function,
      })),
    };
    stacktrace.frames = stripVars(stacktrace.frames);
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
          <StackTraceFrames
            frameContextComponent={FrameContent}
            frameActionsComponent={StoryFrameActions}
          />
        </StoryStackTraceProvider>
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

const HoverActionsSlot = styled(Flex)<{visible: boolean}>`
  align-items: center;
  gap: ${p => p.theme.space.sm};
  width: ${p => (p.visible ? 'max-content' : '0')};
  flex: ${p => (p.visible ? '0 0 max-content' : '0 0 0')};
  height: ${p => (p.visible ? '28px' : '0')};
  min-height: ${p => (p.visible ? '28px' : '0')};
  overflow: hidden;
  pointer-events: none;

  > * {
    pointer-events: auto;
  }
`;
