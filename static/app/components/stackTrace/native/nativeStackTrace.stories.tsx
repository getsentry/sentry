import {Fragment, useMemo, useState} from 'react';
import styled from '@emotion/styled';

import {Button, ButtonBar} from '@sentry/scraps/button';
import {Flex} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';
import {Tooltip} from '@sentry/scraps/tooltip';

import {CopyAsDropdown} from 'sentry/components/copyAsDropdown';
import {ThreadSelector} from 'sentry/components/events/interfaces/threads/threadSelector';
import {SymbolicatorStatus} from 'sentry/components/events/interfaces/types';
import {DisplayOptions} from 'sentry/components/stackTrace/displayOptions';
import {
  ExceptionDescription,
  ExceptionHeader,
} from 'sentry/components/stackTrace/exceptionHeader';
import {FrameContent} from 'sentry/components/stackTrace/frame/frameContent';
import {
  StackTraceViewStateProvider,
  useStackTraceFrameContext,
} from 'sentry/components/stackTrace/stackTraceContext';
import {StackTraceFrames} from 'sentry/components/stackTrace/stackTraceFrames';
import {StackTraceProvider} from 'sentry/components/stackTrace/stackTraceProvider';
import {IconChevron, IconCopy, IconGithub} from 'sentry/icons';
import {t} from 'sentry/locale';
import * as Storybook from 'sentry/stories';
import {ImageStatus} from 'sentry/types/debugImage';
import {
  EntryType,
  EventOrGroupType,
  type Event,
  type Frame,
  type Thread,
} from 'sentry/types/event';
import type {Organization} from 'sentry/types/organization';
import type {StacktraceType} from 'sentry/types/stacktrace';
import {SectionKey} from 'sentry/views/issueDetails/streamline/context';
import {InterimSection} from 'sentry/views/issueDetails/streamline/interimSection';

import {NativeDefaultActions} from './frame/actions/nativeDefaultActions';
import {NativeStackTraceFrames} from './nativeStackTraceFrames';
import {NativeStackTraceProvider} from './nativeStackTraceProvider';
import {RawDownloadAction} from './rawDownloadAction';

type StacktraceWithFrames = StacktraceType & {
  frames: NonNullable<StacktraceType['frames']>;
};

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

function makeEvent(_stacktrace: StacktraceWithFrames, images: any[] = []): Event {
  return {
    id: '1',
    message: 'EXC_BAD_ACCESS',
    title: 'EXC_BAD_ACCESS',
    metadata: {},
    entries: images.length ? [{type: EntryType.DEBUGMETA, data: {images} as any}] : [],
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

  return {event: makeEvent(stacktrace, [image]), stacktrace};
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
    <StackTraceViewStateProvider platform={event.platform}>
      <NativeStackTraceProvider event={event} stacktrace={stacktrace}>
        {children}
      </NativeStackTraceProvider>
    </StackTraceViewStateProvider>
  );
}

function NativeStoryFrameActions({isHovering}: {isHovering: boolean}) {
  const {isExpanded} = useStackTraceFrameContext();
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
      <NativeDefaultActions />
    </Fragment>
  );
}

const HoverActionsSlot = styled(Flex)<{visible: boolean}>`
  align-items: center;
  gap: ${p => p.theme.space.xs};
  opacity: ${p => (p.visible ? 1 : 0)};
  pointer-events: ${p => (p.visible ? 'auto' : 'none')};
`;

export default Storybook.story('Native StackTrace', story => {
  story('NativeIssueStackTrace - Default', () => <NativeIssueStackTraceStory />);

  story('Default', () => {
    const {event, stacktrace} = makeBasicData();
    return (
      <StoryProvider event={event} stacktrace={stacktrace}>
        <NativeStackTraceFrames />
      </StoryProvider>
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

  story('Absolute Addresses', () => {
    const {event, stacktrace} = makeBasicData();
    return (
      <StoryProvider event={event} stacktrace={stacktrace}>
        <NativeStackTraceFrames absoluteAddresses />
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

    const event = makeEvent(stacktrace);

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

type NamedThread = Thread & {platform: 'cocoa' | 'javascript'};

function makeThread(
  id: number,
  name: string,
  stacktrace: StacktraceWithFrames,
  platform: NamedThread['platform'],
  overrides: Partial<Thread> = {}
): NamedThread {
  return {
    id,
    name,
    crashed: false,
    current: false,
    rawStacktrace: null,
    stacktrace,
    state: 'RUNNABLE',
    platform,
    ...overrides,
  };
}

function makeMultiThreadData() {
  const image = makeImage('0x100000000');

  const mainThreadStack: StacktraceWithFrames = {
    framesOmitted: null,
    hasSystemFrames: true,
    registers: {rax: '0x0000000000000001', rip: '0x000000010001a000'},
    frames: [
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
        function: 'objc_msgSend',
        package: '/usr/lib/libobjc.A.dylib',
        instructionAddr: '0x10005f3c4',
        inApp: false,
      }),
    ],
  };

  const workerThreadStack: StacktraceWithFrames = {
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
        inApp: true,
      }),
    ],
  };

  // A JavaScript (React Native) thread — rendered with the generic stack trace.
  const jsThreadStack: StacktraceWithFrames = {
    framesOmitted: null,
    hasSystemFrames: true,
    registers: null,
    frames: [
      {
        absPath: 'app/screens/Home.tsx',
        colNo: 18,
        lineNo: 42,
        filename: 'app/screens/Home.tsx',
        function: 'Home.onMount',
        module: 'app.screens.Home',
        package: null,
        platform: 'javascript',
        context: [
          [40, 'function Home() {'],
          [41, '  useEffect(() => {'],
          [42, "    fetch('/api/posts').then(r => r.json())"],
          [43, '  }, [])'],
        ],
        inApp: true,
        instructionAddr: null,
        symbolAddr: null,
        symbol: null,
        rawFunction: null,
        trust: null,
        vars: {},
      },
      {
        absPath: 'app/screens/Home.tsx',
        colNo: 5,
        lineNo: 38,
        filename: 'app/screens/Home.tsx',
        function: 'Home',
        module: 'app.screens.Home',
        package: null,
        platform: 'javascript',
        context: [
          [36, 'export default function Home() {'],
          [37, '  const [posts, setPosts] = useState([])'],
          [38, '  const user = useUser()'],
          [39, '  return <PostList posts={posts} />'],
        ],
        inApp: true,
        instructionAddr: null,
        symbolAddr: null,
        symbol: null,
        rawFunction: null,
        trust: null,
        vars: {},
      },
    ],
  };

  const threads: NamedThread[] = [
    makeThread(0, 'com.apple.main-thread', mainThreadStack, 'cocoa', {
      crashed: true,
      current: true,
    }),
    makeThread(1, 'background-worker', workerThreadStack, 'cocoa', {state: 'WAITING'}),
    makeThread(2, 'js-bundle', jsThreadStack, 'javascript', {state: 'RUNNABLE'}),
  ];

  const event = {
    id: '1',
    message: 'EXC_BAD_ACCESS',
    title: 'EXC_BAD_ACCESS',
    metadata: {},
    entries: [
      {type: EntryType.DEBUGMETA, data: {images: [image]} as any},
      {type: EntryType.THREADS, data: {values: threads}} as any,
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

  return {event, threads};
}

function ActiveThreadFrames({event, thread}: {event: Event; thread: NamedThread}) {
  const stacktrace = thread.stacktrace;
  if (!stacktrace) {
    return <Text variant="muted">{t('No stack trace for this thread')}</Text>;
  }

  if (thread.platform === 'javascript') {
    return (
      <StackTraceProvider event={event} stacktrace={stacktrace} platform="javascript">
        <StackTraceFrames frameContextComponent={FrameContent} />
      </StackTraceProvider>
    );
  }

  return (
    <NativeStackTraceProvider event={event} stacktrace={stacktrace}>
      <NativeStackTraceFrames frameActionsComponent={NativeStoryFrameActions} />
    </NativeStackTraceProvider>
  );
}

function NativeIssueStackTraceStory() {
  const {event, threads} = useMemo(() => makeMultiThreadData(), []);
  const [activeThread, setActiveThread] = useState(threads[0]!);

  const handleChange = (direction: 'previous' | 'next') => {
    const currentIndex = threads.findIndex(thread => thread.id === activeThread.id);
    let nextIndex = direction === 'previous' ? currentIndex - 1 : currentIndex + 1;
    if (nextIndex < 0) {
      nextIndex = threads.length - 1;
    } else if (nextIndex >= threads.length) {
      nextIndex = 0;
    }
    setActiveThread(threads[nextIndex]!);
  };

  const copyItems = CopyAsDropdown.makeDefaultCopyAsOptions({
    text: () =>
      (activeThread.stacktrace?.frames ?? [])
        .map(
          frame =>
            `  ${frame.instructionAddr ?? ''}  ${frame.function ?? ''}  (${frame.filename ?? ''})`
        )
        .join('\n'),
    json: undefined,
    markdown: undefined,
  });

  const sectionActions = (
    <Flex align="center" gap="sm">
      <RawDownloadAction
        organization={{slug: 'org-slug'} as Organization}
        projectSlug="project-slug"
        eventId={event.eventID}
      />
      <DisplayOptions />
      <CopyAsDropdown size="xs" items={copyItems} />
    </Flex>
  );

  return (
    // Re-key on the active thread so view state (app/full/raw) resets per thread
    // and the provider sees the correct default platform.
    <StackTraceViewStateProvider key={activeThread.id} platform={activeThread.platform}>
      <InterimSection
        type={SectionKey.EXCEPTION}
        title={t('Stack Trace')}
        actions={sectionActions}
      >
        <Flex direction="column" gap="lg">
          <Flex direction="column" gap="sm">
            <ExceptionHeader type="EXC_BAD_ACCESS" module="CrashyApp" />
            <ExceptionDescription
              value="Attempted to dereference garbage pointer 0x0000000000000001"
              mechanism={{handled: false, type: 'mach', synthetic: false}}
            />
          </Flex>
          <Flex align="center" gap="md" wrap="wrap">
            <ButtonBar>
              <Button
                size="xs"
                icon={<IconChevron direction="left" />}
                aria-label={t('Previous Thread')}
                onClick={() => handleChange('previous')}
              />
              <Button
                size="xs"
                icon={<IconChevron direction="right" />}
                aria-label={t('Next Thread')}
                onClick={() => handleChange('next')}
              />
            </ButtonBar>
            <ThreadSelector
              threads={threads}
              activeThread={activeThread}
              event={event}
              onChange={thread => setActiveThread(thread as NamedThread)}
              exception={undefined}
            />
            {activeThread.crashed ? (
              <Text variant="danger" size="sm" bold>
                {t('crashed')}
              </Text>
            ) : (
              <Text variant="muted" size="sm">
                {activeThread.state}
              </Text>
            )}
            {activeThread.platform === 'javascript' ? (
              <Text variant="muted" size="sm">
                {t('rendered with the generic (non-native) stack trace')}
              </Text>
            ) : null}
          </Flex>
          <ActiveThreadFrames event={event} thread={activeThread} />
        </Flex>
      </InterimSection>
    </StackTraceViewStateProvider>
  );
}
