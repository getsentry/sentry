import {Fragment} from 'react';

import {Container, Stack} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

import {SymbolicatorStatus} from 'sentry/components/events/interfaces/types';
import {StackTraceDisplayOptionsProvider} from 'sentry/components/stackTrace/displayOptionsContext';
import * as Storybook from 'sentry/stories';
import {ImageStatus} from 'sentry/types/debugImage';
import {
  EntryType,
  EventOrGroupType,
  type Event,
  type Frame,
  type Thread,
} from 'sentry/types/event';
import type {StacktraceType} from 'sentry/types/stacktrace';

import {IssueThreadStackTrace} from './issueThreadStackTrace';
import {NativeStackTraceFrames} from './nativeStackTraceFrames';
import {NativeStackTraceProvider} from './nativeStackTraceProvider';

type StacktraceWithFrames = StacktraceType & {
  frames: NonNullable<StacktraceType['frames']>;
};

const DISPLAY_OPTIONS_STORAGE_KEY =
  'issue-details-stracktrace-display-org-slug-project-slug';

function makeFrame(overrides: Partial<Frame>): Frame {
  return {
    absPath: '/build/CrashyApp.app/Frameworks/MyLib.framework/MyLib',
    colNo: null,
    lineNo: null,
    context: [],
    filename: 'MyLib.m',
    function: '-[MyLibFoo barWithBaz:]',
    inApp: true,
    instructionAddr: '0x10001a000',
    module: null,
    package: '/build/CrashyApp.app/Frameworks/MyLib.framework/MyLib.dylib',
    platform: 'cocoa',
    rawFunction: null,
    symbol: null,
    symbolAddr: '0x100000000',
    symbolicatorStatus: SymbolicatorStatus.SYMBOLICATED,
    trust: 'cfi',
    vars: {},
    ...overrides,
  };
}

function makeImage(addr: string, overrides: Partial<any> = {}) {
  return {
    type: 'macho',
    image_addr: addr,
    image_size: 0x100000,
    image_vmaddr: '0x0',
    code_id: 'aaaaaaaaaaaa',
    code_file: '/build/CrashyApp.app/Frameworks/MyLib.framework/MyLib',
    debug_id: '11111111-1111-1111-1111-111111111111',
    debug_file: 'MyLib.dSYM',
    arch: 'arm64',
    debug_status: ImageStatus.FOUND,
    unwind_status: ImageStatus.FOUND,
    ...overrides,
  };
}

function makeEvent(images: any[] = [], entries: Event['entries'] = []): Event {
  return {
    id: '1',
    message: 'EXC_BAD_ACCESS',
    title: 'EXC_BAD_ACCESS',
    metadata: {},
    entries: [
      ...(images.length ? [{type: EntryType.DEBUGMETA, data: {images} as any}] : []),
      ...entries,
    ],
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
    platform: 'cocoa',
  } as Event;
}

function makeBasicData(imageOverrides: Partial<any> = {}) {
  const image = makeImage('0x100000000', imageOverrides);
  const frames: Frame[] = [
    makeFrame({
      function: 'main',
      filename: 'main.m',
      lineNo: 21,
      instructionAddr: '0x100002000',
      package: '/build/CrashyApp.app/CrashyApp',
      inApp: true,
    }),
    makeFrame({
      function: '-[CrashyAppDelegate applicationDidFinishLaunching:]',
      filename: 'CrashyAppDelegate.m',
      lineNo: 47,
      instructionAddr: '0x100012abc',
      inApp: true,
    }),
    makeFrame({
      function: '-[MyLibFoo barWithBaz:]',
      instructionAddr: '0x10001a000',
      inApp: false,
    }),
    makeFrame({
      function: 'objc_msgSend',
      package: '/usr/lib/libobjc.A.dylib',
      instructionAddr: '0x10005f3c4',
      symbolicatorStatus: SymbolicatorStatus.SYMBOLICATED,
      inApp: false,
    }),
  ];

  const stacktrace: StacktraceWithFrames = {
    framesOmitted: null,
    hasSystemFrames: true,
    registers: {rax: '0x0000000000000001', rip: '0x000000010001a000'},
    frames,
  };

  return {event: makeEvent([image]), image, stacktrace};
}

function StoryProvider({
  children,
  event,
  stacktrace,
}: {
  children: React.ReactNode;
  event: Event;
  stacktrace: StacktraceType;
}) {
  return (
    <StackTraceDisplayOptionsProvider
      platform={event.platform}
      storageKey={DISPLAY_OPTIONS_STORAGE_KEY}
    >
      <NativeStackTraceProvider event={event} stacktrace={stacktrace}>
        {children}
      </NativeStackTraceProvider>
    </StackTraceDisplayOptionsProvider>
  );
}

export default Storybook.story('Native StackTrace', story => {
  story('Issue Thread Stack Trace', () => {
    const {event, threads} = makeMultiThreadData();
    return (
      <IssueThreadStackTrace
        event={event}
        data={{values: threads}}
        group={undefined}
        groupingCurrentLevel={0}
        projectSlug="project-slug"
      />
    );
  });

  story('Default', () => {
    const {event, stacktrace} = makeBasicData();
    return (
      <StoryProvider event={event} stacktrace={stacktrace}>
        <NativeStackTraceFrames />
      </StoryProvider>
    );
  });

  story('Narrow Containers', () => {
    const {event, threads} = makeMultiThreadData();
    const mainFrames = threads[0]!.stacktrace!.frames!;
    mainFrames.splice(
      1,
      0,
      makeFrame({
        function:
          'std::__1::__function::__func<CrashyApp::Loader::start()::$_0, std::__1::allocator<CrashyApp::Loader::start()::$_0>, void ()>::operator()()',
        filename: 'Loader.cpp',
        lineNo: 112,
        instructionAddr: '0x100031f80',
        package: '/build/CrashyApp.app/CrashyApp',
        context: [
          [111, '  auto task = [this] {'],
          [112, '    this->config->reload();'],
          [113, '  };'],
        ],
      }),
      makeFrame({
        function: null,
        filename: null,
        absPath: null,
        instructionAddr: '0x10a2f3c10',
        package: '/build/CrashyApp.app/Frameworks/Analytics.framework/Analytics',
        symbolicatorStatus: SymbolicatorStatus.MISSING,
      })
    );
    return (
      <Stack gap="xl">
        {[360, 700].map(width => (
          <Stack key={width} gap="sm" width={`${width}px`} maxWidth="100%">
            <Text>{width}px container</Text>
            <Container border="primary" radius="md" padding="md">
              <IssueThreadStackTrace
                event={event}
                data={{values: threads}}
                group={undefined}
                groupingCurrentLevel={0}
                projectSlug="project-slug"
              />
            </Container>
          </Stack>
        ))}
      </Stack>
    );
  });

  story('Missing Debug File', () => {
    const {event, stacktrace} = makeBasicData({
      debug_status: ImageStatus.MISSING,
      unwind_status: ImageStatus.MISSING,
    });
    return (
      <Fragment>
        <p>
          The debug image's <code>debug_status</code> is <code>missing</code>, so frames
          resolved to it render a broken-file icon — they could not be symbolicated.
        </p>
        <StoryProvider event={event} stacktrace={stacktrace}>
          <NativeStackTraceFrames />
        </StoryProvider>
      </Fragment>
    );
  });

  story('Inline Frame', () => {
    const {event, stacktrace} = makeBasicData();
    stacktrace.frames[1] = makeFrame({
      ...stacktrace.frames[1]!,
      instructionAddr: stacktrace.frames[0]!.instructionAddr,
    });
    return (
      <Fragment>
        <p>
          When two adjacent frames share an <code>instructionAddr</code>, the second
          renders with an "Inline frame" tooltip on its address cell.
        </p>
        <StoryProvider event={event} stacktrace={stacktrace}>
          <NativeStackTraceFrames />
        </StoryProvider>
      </Fragment>
    );
  });

  story('Found by Stack Scanning', () => {
    const {event, stacktrace} = makeBasicData();
    stacktrace.frames[2] = makeFrame({
      ...stacktrace.frames[2]!,
      trust: 'scan',
    });
    return (
      <StoryProvider event={event} stacktrace={stacktrace}>
        <NativeStackTraceFrames />
      </StoryProvider>
    );
  });

  story('Long Package Names', () => {
    const {event, stacktrace} = makeBasicData();
    stacktrace.frames = stacktrace.frames.map(frame => ({
      ...frame,
      package:
        '/Users/runner/Library/Developer/Xcode/DerivedData/Long/Path/Build/Products/Debug-iphonesimulator/MyLib.framework/MyLib.dylib',
    }));
    return (
      <StoryProvider event={event} stacktrace={stacktrace}>
        <NativeStackTraceFrames />
      </StoryProvider>
    );
  });

  story('Omitted Frames', () => {
    const {event, stacktrace} = makeBasicData();
    // Backend signals that frames between indices [start, end) were omitted —
    // typically a "..." middle of a deeply recursive stack. The renderer
    // shows a banner row in that position.
    stacktrace.framesOmitted = [1, 3];
    return (
      <Fragment>
        <p>
          When the backend sets <code>framesOmitted</code> on a stacktrace, a banner row
          appears between the surrounding frames showing the omitted range.
        </p>
        <StoryProvider event={event} stacktrace={stacktrace}>
          <NativeStackTraceFrames />
        </StoryProvider>
      </Fragment>
    );
  });

  story('Crashed Thread with Registers', () => {
    const {event, stacktrace} = makeBasicData();
    return (
      <Fragment>
        <p>
          The last frame is the crashing frame and renders the captured CPU registers in
          the expanded body. Click the chevron on the first row to reveal it.
        </p>
        <StoryProvider event={event} stacktrace={stacktrace}>
          <NativeStackTraceFrames />
        </StoryProvider>
      </Fragment>
    );
  });

  story('Dart Async Suspension', () => {
    // Synthetic frames the Dart SDK emits to mark async/await boundaries.
    // The marker frame has filename "<asynchronous suspension>" and no
    // function/package; the renderer should substitute "Dart" / "Dart async".
    const frames: Frame[] = [
      makeFrame({
        platform: 'native',
        function: 'main',
        filename: 'main.dart',
        absPath: 'package:my_app/main.dart',
        package: null,
        instructionAddr: null,
        symbolAddr: null,
        symbolicatorStatus: SymbolicatorStatus.SYMBOLICATED,
        inApp: true,
      }),
      makeFrame({
        platform: 'native',
        function: 'fetchPosts',
        filename: 'screens/home.dart',
        absPath: 'package:my_app/screens/home.dart',
        package: null,
        instructionAddr: null,
        symbolAddr: null,
        symbolicatorStatus: SymbolicatorStatus.SYMBOLICATED,
        inApp: true,
      }),
      makeFrame({
        platform: 'native',
        function: null,
        filename: '<asynchronous suspension>',
        absPath: '<asynchronous suspension>',
        package: null,
        instructionAddr: null,
        symbolAddr: null,
        symbolicatorStatus: SymbolicatorStatus.SYMBOLICATED,
        inApp: false,
      }),
      makeFrame({
        platform: 'native',
        function: 'HomeState.initState',
        filename: 'screens/home.dart',
        absPath: 'package:my_app/screens/home.dart',
        package: null,
        instructionAddr: null,
        symbolAddr: null,
        symbolicatorStatus: SymbolicatorStatus.SYMBOLICATED,
        inApp: true,
      }),
    ];

    const stacktrace: StacktraceWithFrames = {
      framesOmitted: null,
      hasSystemFrames: true,
      registers: null,
      frames,
    };

    const event = makeEvent();

    return (
      <Fragment>
        <p>
          Dart inserts a synthetic frame with filename{' '}
          <code>{'<asynchronous suspension>'}</code> at every <code>await</code> boundary.
          The renderer shows <code>Dart</code> for the function and{' '}
          <code>Dart async</code> for the package on those rows, and treats them as
          symbolicated (no error icon).
        </p>
        <StoryProvider event={event} stacktrace={stacktrace}>
          <NativeStackTraceFrames />
        </StoryProvider>
      </Fragment>
    );
  });
});

function makeThread(overrides: Partial<Thread> & Pick<Thread, 'id' | 'name'>): Thread {
  return {
    crashed: false,
    current: false,
    rawStacktrace: null,
    stacktrace: null,
    state: 'RUNNABLE',
    ...overrides,
  };
}

/**
 * A crashed main thread whose exception borrows the thread's frames, a waiting
 * worker, and a React Native JavaScript thread that renders generic rows.
 */
function makeMultiThreadData() {
  const {image, stacktrace} = makeBasicData();
  const threads = [
    makeThread({
      id: 0,
      name: 'com.apple.main-thread',
      crashed: true,
      current: true,
      stacktrace,
    }),
    makeThread({
      id: 1,
      name: 'background-worker',
      state: 'WAITING',
      stacktrace: {
        framesOmitted: null,
        hasSystemFrames: true,
        registers: null,
        frames: [
          makeFrame({
            function: '__pthread_cond_wait',
            package: '/usr/lib/system/libsystem_pthread.dylib',
            instructionAddr: '0x10003a100',
            inApp: false,
          }),
          makeFrame({
            function: 'WorkerPool::run()',
            filename: 'WorkerPool.cpp',
            lineNo: 88,
            instructionAddr: '0x100040500',
          }),
        ],
      },
    }),
    makeThread({
      id: 2,
      name: 'js-bundle',
      stacktrace: {
        framesOmitted: null,
        hasSystemFrames: false,
        registers: null,
        frames: [
          makeFrame({
            platform: 'javascript',
            function: 'Home.onMount',
            filename: 'app/screens/Home.tsx',
            absPath: 'app/screens/Home.tsx',
            lineNo: 42,
            colNo: 18,
            package: null,
            instructionAddr: null,
            symbolAddr: null,
            context: [
              [41, '  useEffect(() => {'],
              [42, "    fetch('/api/posts').then(r => r.json())"],
              [43, '  }, [])'],
            ],
          }),
        ],
      },
    }),
  ];

  const event = makeEvent(
    [image],
    [
      {
        type: EntryType.EXCEPTION,
        data: {
          excOmitted: null,
          hasSystemFrames: true,
          values: [
            {
              type: 'EXC_BAD_ACCESS',
              value: 'Attempted to dereference garbage pointer 0x0000000000000001',
              module: null,
              mechanism: {handled: false, type: 'mach', synthetic: false},
              threadId: 0,
              stacktrace: null,
              rawStacktrace: null,
            },
          ],
        },
      },
      {type: EntryType.THREADS, data: {values: threads}},
    ]
  );

  return {event, threads};
}
