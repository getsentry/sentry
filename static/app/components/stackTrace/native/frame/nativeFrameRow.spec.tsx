import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {SymbolicatorStatus} from 'sentry/components/events/interfaces/types';
import {NativeStackTraceFrames} from 'sentry/components/stackTrace/native/nativeStackTraceFrames';
import {NativeStackTraceProvider} from 'sentry/components/stackTrace/native/nativeStackTraceProvider';
import {StackTraceViewStateProvider} from 'sentry/components/stackTrace/stackTraceContext';
import {ImageStatus} from 'sentry/types/debugImage';
import {EntryType, EventOrGroupType, type Event, type Frame} from 'sentry/types/event';
import type {StacktraceType} from 'sentry/types/stacktrace';

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

function renderFrames(stacktrace: StacktraceType, event: Event) {
  return render(
    <StackTraceViewStateProvider platform="cocoa">
      <NativeStackTraceProvider event={event} stacktrace={stacktrace}>
        <NativeStackTraceFrames />
      </NativeStackTraceProvider>
    </StackTraceViewStateProvider>
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
    renderFrames(stacktrace, makeEvent(stacktrace));

    expect(screen.getByText('Dart')).toBeInTheDocument();
    expect(screen.getByText('Dart async')).toBeInTheDocument();
    // Dart frames are treated as symbolicated, no error icon.
    expect(screen.queryByTestId('symbolication-error-icon')).not.toBeInTheDocument();
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
