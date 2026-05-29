import {render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

import {
  DebugMetaSearchProvider,
  useDebugMetaSearch,
} from 'sentry/components/events/interfaces/debugMeta/debugMetaSearchContext';
import {SymbolicatorStatus} from 'sentry/components/events/interfaces/types';
import {NATIVE_DISPLAY_OPTION} from 'sentry/components/stackTrace/native/nativeDisplayOptionsPersistence';
import {NativeStackTraceFrames} from 'sentry/components/stackTrace/native/nativeStackTraceFrames';
import {NativeStackTraceProvider} from 'sentry/components/stackTrace/native/nativeStackTraceProvider';
import {StackTraceViewStateProvider} from 'sentry/components/stackTrace/stackTraceContext';
import type {StackTraceMeta, StackTraceView} from 'sentry/components/stackTrace/types';
import {ImageStatus} from 'sentry/types/debugImage';
import {EntryType, EventOrGroupType, type Event, type Frame} from 'sentry/types/event';
import type {StacktraceType} from 'sentry/types/stacktrace';
import {localStorageWrapper} from 'sentry/utils/localStorage';
import {IssueDetailsContext, SectionKey} from 'sentry/views/issueDetails/context';
import {getFoldSectionKey} from 'sentry/views/issueDetails/foldSection';

function makeFrame(overrides: Partial<Frame>): Frame {
  return {
    absPath: null,
    colNo: null,
    lineNo: null,
    context: [],
    filename: 'CrashyAppDelegate.m',
    function: '-[CrashyAppDelegate applicationDidFinishLaunching:]',
    inApp: true,
    instructionAddr: '0x100012000',
    module: null,
    package: '/build/CrashyApp.app/CrashyApp',
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

function makeEvent(_stacktrace: StacktraceType, images: any[] = []): Event {
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

function makeImage(overrides: any = {}) {
  return {
    type: 'macho',
    image_addr: '0x100000000',
    image_size: 0x100000,
    code_id: 'aaaa',
    code_file: '/build/CrashyApp.app/CrashyApp',
    debug_id: '11111111-1111-1111-1111-111111111111',
    debug_file: 'CrashyApp.dSYM',
    arch: 'arm64',
    debug_status: ImageStatus.FOUND,
    unwind_status: ImageStatus.FOUND,
    ...overrides,
  };
}

function renderFrames(
  stacktrace: StacktraceType,
  event: Event,
  {
    defaultView = 'app',
    defaultIsNewestFirst = true,
    displayOptionsStorageKey,
    groupingCurrentLevel,
    meta,
  }: {
    defaultIsNewestFirst?: boolean;
    defaultView?: StackTraceView;
    displayOptionsStorageKey?: string;
    groupingCurrentLevel?: number;
    meta?: StackTraceMeta;
  } = {}
) {
  return render(
    <StackTraceViewStateProvider
      platform="cocoa"
      defaultView={defaultView}
      defaultIsNewestFirst={defaultIsNewestFirst}
    >
      <NativeStackTraceProvider
        event={event}
        stacktrace={stacktrace}
        displayOptionsStorageKey={displayOptionsStorageKey}
        groupingCurrentLevel={groupingCurrentLevel}
        meta={meta}
      >
        <NativeStackTraceFrames />
      </NativeStackTraceProvider>
    </StackTraceViewStateProvider>
  );
}

function DebugMetaSearchProbe() {
  const {searchTerm} = useDebugMetaSearch();
  return <div data-test-id="debug-meta-search-term">{searchTerm}</div>;
}

function renderFramesWithDebugMeta(stacktrace: StacktraceType, event: Event) {
  return render(
    <IssueDetailsContext
      value={{
        detectorDetails: {},
        dispatch: jest.fn(),
        eventCount: 0,
        isSidebarOpen: true,
        navScrollMargin: 0,
        sectionData: {
          [SectionKey.DEBUGMETA]: {
            key: SectionKey.DEBUGMETA,
            initialCollapse: true,
          },
        },
      }}
    >
      <DebugMetaSearchProvider>
        <StackTraceViewStateProvider platform="cocoa">
          <NativeStackTraceProvider event={event} stacktrace={stacktrace}>
            <NativeStackTraceFrames />
          </NativeStackTraceProvider>
        </StackTraceViewStateProvider>
        <DebugMetaSearchProbe />
        <div id={SectionKey.DEBUGMETA} />
      </DebugMetaSearchProvider>
    </IssueDetailsContext>
  );
}

describe('NativeFrameRow', () => {
  it('renders a relative offset address when a debug image matches', () => {
    const stacktrace: StacktraceType = {
      framesOmitted: null,
      hasSystemFrames: false,
      registers: null,
      frames: [makeFrame({instructionAddr: '0x100012abc'})],
    };
    renderFrames(stacktrace, makeEvent(stacktrace, [makeImage()]));

    expect(screen.getByText('+0x12abc')).toBeInTheDocument();
  });

  it('renders the absolute address when no debug image is found', () => {
    const stacktrace: StacktraceType = {
      framesOmitted: null,
      hasSystemFrames: false,
      registers: null,
      frames: [makeFrame({instructionAddr: '0xdeadbeef'})],
    };
    renderFrames(stacktrace, makeEvent(stacktrace));

    expect(screen.getByText('0xdeadbeef')).toBeInTheDocument();
  });

  it('shows a symbolication error icon when debug files are missing', () => {
    const stacktrace: StacktraceType = {
      framesOmitted: null,
      hasSystemFrames: false,
      registers: null,
      frames: [
        makeFrame({
          symbolicatorStatus: SymbolicatorStatus.MISSING,
          instructionAddr: '0xdeadbeef',
        }),
      ],
    };
    renderFrames(stacktrace, makeEvent(stacktrace));

    expect(screen.getByTestId('symbolication-error-icon')).toBeInTheDocument();
  });

  it("shows an error icon when the resolved image's debug files are missing", () => {
    // Image is found for the frame's address, but its debug_status is MISSING.
    // The image-level status must win over the frame's symbolicatorStatus.
    const stacktrace: StacktraceType = {
      framesOmitted: null,
      hasSystemFrames: false,
      registers: null,
      frames: [
        makeFrame({
          symbolicatorStatus: SymbolicatorStatus.SYMBOLICATED,
          instructionAddr: '0x100012abc',
        }),
      ],
    };
    renderFrames(
      stacktrace,
      makeEvent(stacktrace, [
        makeImage({
          debug_status: ImageStatus.MISSING,
          unwind_status: ImageStatus.MISSING,
        }),
      ])
    );

    expect(screen.getByTestId('symbolication-error-icon')).toBeInTheDocument();
  });

  it("does not show a status icon when the resolved image's debug files are found", () => {
    const stacktrace: StacktraceType = {
      framesOmitted: null,
      hasSystemFrames: false,
      registers: null,
      frames: [
        makeFrame({
          symbolicatorStatus: SymbolicatorStatus.SYMBOLICATED,
          instructionAddr: '0x100012abc',
        }),
      ],
    };
    renderFrames(stacktrace, makeEvent(stacktrace, [makeImage()]));

    expect(screen.queryByTestId('symbolication-error-icon')).not.toBeInTheDocument();
    expect(screen.queryByTestId('symbolication-warning-icon')).not.toBeInTheDocument();
  });

  it('renders the function name and trimmed package', () => {
    const stacktrace: StacktraceType = {
      framesOmitted: null,
      hasSystemFrames: false,
      registers: null,
      frames: [
        makeFrame({
          function: 'main',
          package: '/usr/lib/libSystem.B.dylib',
          instructionAddr: '0x100012abc',
        }),
      ],
    };
    renderFrames(stacktrace, makeEvent(stacktrace, [makeImage()]));

    expect(screen.getByText('main')).toBeInTheDocument();
    expect(screen.getByText('libSystem.B')).toBeInTheDocument();
  });

  it('renders redaction metadata on native frame function names', () => {
    const stacktrace: StacktraceType = {
      framesOmitted: null,
      hasSystemFrames: false,
      registers: null,
      frames: [
        makeFrame({
          function: 'secret_function',
          instructionAddr: '0x100012abc',
        }),
      ],
    };
    renderFrames(stacktrace, makeEvent(stacktrace, [makeImage()]), {
      meta: {
        frames: [
          {
            function: {
              '': {
                chunks: [
                  {
                    type: 'redaction',
                    text: '<redacted>',
                    rule_id: 'project:0',
                    remark: 's',
                  },
                  {type: 'text', text: ''},
                ],
              },
            },
          },
        ],
      },
    });

    expect(screen.getByText('<redacted>')).toBeInTheDocument();
    expect(screen.queryByText('secret_function')).not.toBeInTheDocument();
  });

  it('renders grouping markers in default native frame actions', () => {
    const stacktrace: StacktraceType = {
      framesOmitted: null,
      hasSystemFrames: false,
      registers: null,
      frames: [
        makeFrame({
          function: 'grouping_frame',
          inApp: false,
          minGroupingLevel: 0,
        }),
      ],
    };
    renderFrames(stacktrace, makeEvent(stacktrace), {groupingCurrentLevel: 0});

    expect(
      screen.getByLabelText('This frame is repeated in every event of this issue')
    ).toBeInTheDocument();
  });

  it('only renders verbose raw functions when they differ from the function name', () => {
    const storageKey = 'native-frame-row-verbose-functions';
    localStorageWrapper.setItem(
      storageKey,
      JSON.stringify([NATIVE_DISPLAY_OPTION.VERBOSE_FUNCTION_NAMES])
    );
    const stacktrace: StacktraceType = {
      framesOmitted: null,
      hasSystemFrames: false,
      registers: null,
      frames: [
        makeFrame({
          function: 'demangled_symbol',
          inApp: true,
          rawFunction: '_mangled_symbol',
        }),
        makeFrame({
          function: null,
          inApp: true,
          rawFunction: 'raw_only_symbol',
        }),
      ],
    };
    renderFrames(stacktrace, makeEvent(stacktrace), {
      displayOptionsStorageKey: storageKey,
    });

    expect(screen.getByText('_mangled_symbol')).toBeInTheDocument();
    expect(screen.queryByText('demangled_symbol')).not.toBeInTheDocument();
    expect(screen.queryByText('raw_only_symbol')).not.toBeInTheDocument();
  });

  it('drops the status column when no frame has a status icon', () => {
    const stacktrace: StacktraceType = {
      framesOmitted: null,
      hasSystemFrames: false,
      registers: null,
      frames: [
        makeFrame({
          symbolicatorStatus: SymbolicatorStatus.SYMBOLICATED,
          instructionAddr: '0x100012abc',
        }),
        makeFrame({
          symbolicatorStatus: SymbolicatorStatus.SYMBOLICATED,
          instructionAddr: '0x100013000',
        }),
      ],
    };
    renderFrames(stacktrace, makeEvent(stacktrace, [makeImage()]));

    // None of the frames have an error/warning, so the status column shouldn't
    // be reserved on any row.
    expect(screen.queryByTestId('symbolication-error-icon')).not.toBeInTheDocument();
    expect(screen.queryByTestId('symbolication-warning-icon')).not.toBeInTheDocument();
    expect(screen.queryAllByTestId('native-stack-trace-status-cell')).toHaveLength(0);
  });

  it('reserves the status column on every row when any frame has an icon', () => {
    const stacktrace: StacktraceType = {
      framesOmitted: null,
      hasSystemFrames: false,
      registers: null,
      frames: [
        // Cleanly symbolicated.
        makeFrame({
          symbolicatorStatus: SymbolicatorStatus.SYMBOLICATED,
          instructionAddr: '0x100012abc',
        }),
        // Will trigger an error icon (no image, MISSING status).
        makeFrame({
          symbolicatorStatus: SymbolicatorStatus.MISSING,
          instructionAddr: '0xdeadbeef',
        }),
      ],
    };
    renderFrames(stacktrace, makeEvent(stacktrace, [makeImage()]));

    expect(screen.getByTestId('symbolication-error-icon')).toBeInTheDocument();
    // One status cell reserved per frame, even the cleanly symbolicated row,
    // so addresses/packages stay column-aligned.
    expect(screen.getAllByTestId('native-stack-trace-status-cell')).toHaveLength(2);
  });

  it('renders Dart async suspension labels for Dart async frames', () => {
    // Dart sentinels for async frames: filename or absPath = "<asynchronous suspension>"
    // and no real package/function payload. The native renderer should
    // substitute "Dart async" / "Dart" instead of the generic <unknown>.
    const stacktrace: StacktraceType = {
      framesOmitted: null,
      hasSystemFrames: false,
      registers: null,
      frames: [
        makeFrame({
          filename: '<asynchronous suspension>',
          absPath: '<asynchronous suspension>',
          function: null,
          package: null,
          symbolicatorStatus: SymbolicatorStatus.SYMBOLICATED,
          instructionAddr: '0xdeadbeef',
        }),
      ],
    };
    renderFrames(stacktrace, makeEvent(stacktrace), {defaultView: 'full'});

    expect(screen.getByText('Dart')).toBeInTheDocument();
    expect(screen.getByText('Dart async')).toBeInTheDocument();
    // Dart frames are treated as symbolicated, no error icon.
    expect(screen.queryByTestId('symbolication-error-icon')).not.toBeInTheDocument();
  });

  it('hides Dart async suspension frames in app-only view', () => {
    const stacktrace: StacktraceType = {
      framesOmitted: null,
      hasSystemFrames: true,
      registers: null,
      frames: [
        makeFrame({
          filename: '<asynchronous suspension>',
          absPath: '<asynchronous suspension>',
          function: null,
          inApp: false,
          package: null,
          instructionAddr: '0xdeadbeef',
        }),
        makeFrame({function: 'app_main', inApp: true}),
      ],
    };
    renderFrames(stacktrace, makeEvent(stacktrace));

    expect(screen.getByText('app_main')).toBeInTheDocument();
    expect(screen.queryByText('Dart async')).not.toBeInTheDocument();
    expect(screen.queryByText('Dart')).not.toBeInTheDocument();
  });

  it('shows a warning icon when symbolicatorStatus is MISSING_SYMBOL', () => {
    const stacktrace: StacktraceType = {
      framesOmitted: null,
      hasSystemFrames: false,
      registers: null,
      frames: [
        makeFrame({
          symbolicatorStatus: SymbolicatorStatus.MISSING_SYMBOL,
          instructionAddr: '0xdeadbeef',
        }),
      ],
    };
    renderFrames(stacktrace, makeEvent(stacktrace));

    expect(screen.getByTestId('symbolication-warning-icon')).toBeInTheDocument();
    expect(screen.queryByTestId('symbolication-error-icon')).not.toBeInTheDocument();
  });

  it('reveals hidden system frames when the toggle is clicked', async () => {
    // Default view is "app", which collapses runs of non-app frames into a
    // "Show N more frames" toggle on the last visible non-app row.
    const stacktrace: StacktraceType = {
      framesOmitted: null,
      hasSystemFrames: true,
      registers: null,
      frames: [
        makeFrame({function: 'app_main', inApp: true}),
        makeFrame({function: 'hidden_one', inApp: false}),
        makeFrame({function: 'hidden_two', inApp: false}),
        makeFrame({function: 'hidden_three', inApp: false}),
        // Last system frame stays visible (anchor for the toggle).
        makeFrame({function: 'visible_tail', inApp: false}),
      ],
    };
    renderFrames(stacktrace, makeEvent(stacktrace));

    expect(screen.getByText('app_main')).toBeInTheDocument();
    expect(screen.getByText('visible_tail')).toBeInTheDocument();
    expect(screen.queryByText('hidden_one')).not.toBeInTheDocument();

    await userEvent.click(screen.getByText('Show 3 more frames'));

    expect(screen.getByText('hidden_one')).toBeInTheDocument();
    expect(screen.getByText('hidden_two')).toBeInTheDocument();
    expect(screen.getByText('hidden_three')).toBeInTheDocument();
    expect(
      screen
        .getByText('hidden_one')
        .closest('[data-test-id="native-stack-trace-frame-title"]')
    ).toHaveAttribute('data-sub-frame', 'true');
  });

  it('shows native lead hints only in app-only view', () => {
    const stacktrace: StacktraceType = {
      framesOmitted: null,
      hasSystemFrames: true,
      registers: null,
      frames: [
        makeFrame({function: 'system_entry', inApp: false}),
        makeFrame({function: 'app_main', inApp: true}),
      ],
    };
    const event = makeEvent(stacktrace);
    const {unmount} = renderFrames(stacktrace, event);

    expect(screen.getByText('Called from')).toBeInTheDocument();

    unmount();
    renderFrames(stacktrace, event, {defaultView: 'full'});

    expect(screen.queryByText('Called from')).not.toBeInTheDocument();
  });

  it('expands and filters images loaded when a frame address is clicked', async () => {
    const scrollIntoView = jest.fn();
    Element.prototype.scrollIntoView = scrollIntoView;
    const collapseStorageKey = getFoldSectionKey(SectionKey.DEBUGMETA);
    localStorageWrapper.setItem(collapseStorageKey, JSON.stringify(true));
    const stacktrace: StacktraceType = {
      framesOmitted: null,
      hasSystemFrames: false,
      registers: null,
      frames: [
        makeFrame({
          addrMode: 'rel:0',
          instructionAddr: '0x100012abc',
          symbolicatorStatus: SymbolicatorStatus.SYMBOLICATED,
        }),
      ],
    };

    renderFramesWithDebugMeta(stacktrace, makeEvent(stacktrace, [makeImage()]));

    await userEvent.click(screen.getByText('+0x12abc'));

    expect(screen.getByTestId('debug-meta-search-term')).toHaveTextContent(
      '11111111-1111-1111-1111-111111111111!0x100012abc'
    );
    expect(scrollIntoView).toHaveBeenCalledWith({block: 'start', behavior: 'smooth'});
    await waitFor(() => {
      expect(localStorageWrapper.getItem(collapseStorageKey)).toBe('false');
    });
  });

  it('auto-expands the last in-app frame', () => {
    const stacktrace: StacktraceType = {
      framesOmitted: null,
      hasSystemFrames: true,
      registers: null,
      frames: [
        makeFrame({function: 'app_first', inApp: true, context: [[1, 'first source']]}),
        makeFrame({
          function: 'sys_middle',
          inApp: false,
          context: [[2, 'middle source']],
        }),
        makeFrame({function: 'app_last', inApp: true, context: [[3, 'last source']]}),
      ],
    };
    renderFrames(stacktrace, makeEvent(stacktrace));

    // Default newest-first reverses the display order, so app_last (the
    // last in-app frame in the original array, and the auto-expanded one)
    // shows up first.
    const titles = screen.getAllByTestId('native-stack-trace-frame-title');
    expect(titles[0]).toHaveAttribute('aria-expanded', 'true');
    expect(titles[1]).toHaveAttribute('aria-expanded', 'false');
    expect(titles[2]).toHaveAttribute('aria-expanded', 'false');
  });

  it('auto-expands the first in-app frame when oldest frames are shown first', () => {
    const stacktrace: StacktraceType = {
      framesOmitted: null,
      hasSystemFrames: true,
      registers: null,
      frames: [
        makeFrame({function: 'app_first', inApp: true, context: [[1, 'first source']]}),
        makeFrame({
          function: 'sys_middle',
          inApp: false,
          context: [[2, 'middle source']],
        }),
        makeFrame({function: 'app_last', inApp: true, context: [[3, 'last source']]}),
      ],
    };
    renderFrames(stacktrace, makeEvent(stacktrace), {defaultIsNewestFirst: false});

    const titles = screen.getAllByTestId('native-stack-trace-frame-title');
    expect(titles[0]).toHaveTextContent('app_first');
    expect(titles[0]).toHaveAttribute('aria-expanded', 'true');
    expect(titles[2]).toHaveTextContent('app_last');
    expect(titles[2]).toHaveAttribute('aria-expanded', 'false');
  });

  it('allows a single empty native frame to expand to the empty details message', async () => {
    const stacktrace: StacktraceType = {
      framesOmitted: null,
      hasSystemFrames: false,
      registers: {},
      frames: [
        makeFrame({
          context: [],
          filename: null,
          function: null,
          inApp: false,
          instructionAddr: null,
          package: null,
          rawFunction: null,
          vars: null,
        }),
      ],
    };
    renderFrames(stacktrace, makeEvent(stacktrace));

    const title = screen.getByTestId('native-stack-trace-frame-title');
    expect(title).toHaveAttribute('aria-expanded', 'false');
    expect(
      screen.queryByText('No additional details are available for this frame.')
    ).not.toBeInTheDocument();

    await userEvent.click(title);

    expect(title).toHaveAttribute('aria-expanded', 'true');
    expect(
      screen.getByText('No additional details are available for this frame.')
    ).toBeInTheDocument();
  });

  it('renders an in-app tag for in-app frames', () => {
    const stacktrace: StacktraceType = {
      framesOmitted: null,
      hasSystemFrames: false,
      registers: null,
      frames: [makeFrame({inApp: true})],
    };
    renderFrames(stacktrace, makeEvent(stacktrace));

    expect(screen.getByText('In App')).toBeInTheDocument();
  });
});
