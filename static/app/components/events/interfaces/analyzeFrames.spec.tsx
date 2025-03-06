import {render, screen} from 'sentry-test/reactTestingLibrary';
import {textWithMarkupMatcher} from 'sentry-test/utils';

import {
  analyzeFrameForRootCause,
  analyzeFramesForRootCause,
} from 'sentry/components/events/interfaces/analyzeFrames';
import type {Event, Frame} from 'sentry/types/event';
import {EntryType, EventOrGroupType, LockType} from 'sentry/types/event';

const makeEventWithFrames = (frames: Frame[]): Event => {
  const event: Event = {
    id: '020eb33f6ce64ed6adc60f8993535816',
    groupID: '68',
    eventID: '020eb33f6ce64ed6adc60f8993535816',
    projectID: '2',
    size: 3481,
    entries: [
      {
        data: {
          values: [
            {
              type: 'ZeroDivisionError',
              value: 'divided by 0',
              mechanism: null,
              threadId: null,
              module: '',
              stacktrace: {
                frames: [
                  {
                    filename: 'puma (3.12.6) lib/puma/thread_pool.rb',
                    absPath: 'puma (3.12.6) lib/puma/thread_pool.rb',
                    module: null,
                    package: null,
                    platform: null,
                    instructionAddr: null,
                    symbolAddr: null,
                    function: 'block in spawn_thread',
                    rawFunction: null,
                    symbol: null,
                    context: [],
                    lineNo: 135,
                    colNo: null,
                    inApp: false,
                    trust: null,
                    vars: null,
                  },
                  ...frames,
                ],
                framesOmitted: null,
                registers: null,
                hasSystemFrames: true,
              },
              rawStacktrace: null,
              frames: null,
            },
          ],
          hasSystemFrames: true,
          excOmitted: null,
        },
        type: EntryType.EXCEPTION,
      },
      {
        data: {
          values: [
            {
              id: 13920,
              current: true,
              crashed: true,
              name: 'puma 002',
              stacktrace: null,
              rawStacktrace: null,
              state: 'WAITING',
            },
          ],
        },
        type: EntryType.THREADS,
      },
    ],
    dist: null,
    message: '',
    title: 'ZeroDivisionError: divided by 0',
    location: 'sentry/controllers/welcome_controller.rb',
    user: null,
    contexts: {},
    sdk: null,
    context: {},
    packages: {},
    type: EventOrGroupType.ERROR,
    metadata: {
      filename: 'sentry/controllers/welcome_controller.rb',
      function: '/',
      type: 'ZeroDivisionError',
      value: 'divided by 0',
    },
    tags: [{key: 'level', value: 'error'}],
    platform: 'other',
    dateReceived: '2021-10-28T12:28:22.318469Z',
    errors: [],
    crashFile: null,
    culprit: 'sentry/controllers/welcome_controller.rb in /',
    dateCreated: '2021-10-28T12:28:22.318469Z',
    fingerprints: ['58f1f47bea5239ea25397888dc9253d1'],
    groupingConfig: {
      enhancements: 'eJybzDRxY25-UmZOqpWRgZGhroGJroHRBABbUQb_',
      id: 'newstyle:2023-01-11',
    },
    release: null,
    userReport: null,
    sdkUpdates: [],
    nextEventID: null,
    previousEventID: null,
    occurrence: null,
  };

  return event;
};

describe('analyzeAnrFrames', function () {
  it('detects anr root cause', function () {
    const event = makeEventWithFrames([
      {
        filename: 'SharedPreferencesImpl.java',
        absPath: 'SharedPreferencesImpl.java',
        module: 'android.app.SharedPreferencesImpl$EditorImpl$1',
        package: null,
        platform: null,
        instructionAddr: null,
        symbolAddr: null,
        function: 'run',
        rawFunction: null,
        symbol: null,
        context: [],
        lineNo: 366,
        colNo: null,
        inApp: false,
        trust: null,
        vars: null,
      },
    ]);
    const rootCause = analyzeFramesForRootCause(event);
    expect(rootCause?.resources).toBe(
      'SharedPreferences.apply will save data on background thread only if it happens before the activity/service finishes. Switch to SharedPreferences.commit and move commit to a background thread.'
    );
    expect(rootCause?.culprit).toBe(
      '/^android\\.app\\.SharedPreferencesImpl\\$EditorImpl\\$[0-9]/'
    );
  });

  it('regex matches function names', function () {
    const event = makeEventWithFrames([
      {
        filename: 'sqlite.SQLiteConnection',
        absPath: 'sqlite.SQLiteConnection',
        module: 'android.database.sqlite.SQLiteConnection',
        package: null,
        platform: null,
        instructionAddr: null,
        symbolAddr: null,
        function: 'nativeBindArgs',
        rawFunction: null,
        symbol: null,
        context: [],
        lineNo: 366,
        colNo: null,
        inApp: false,
        trust: null,
        vars: null,
      },
    ]);
    const rootCause = analyzeFramesForRootCause(event);
    expect(rootCause?.resources).toBe(
      'Database operations, such as querying, inserting, updating, or deleting data, can involve disk I/O, processing, and potentially long-running operations. Move database operations off the main thread to avoid this ANR.'
    );
    expect(rootCause?.culprit).toBe('android.database.sqlite.SQLiteConnection');
  });

  it('picks anr root cause of the topmost frame', function () {
    const event = makeEventWithFrames([
      {
        filename: 'Instrumentation.java',
        absPath: 'Instrumentation.java',
        module: 'android.app.Instrumentation',
        package: null,
        platform: null,
        instructionAddr: null,
        symbolAddr: null,
        function: 'callApplicationOnCreate',
        rawFunction: null,
        symbol: null,
        context: [],
        lineNo: 1176,
        colNo: null,
        inApp: false,
        trust: null,
        vars: null,
      },
      {
        filename: 'SharedPreferencesImpl.java',
        absPath: 'SharedPreferencesImpl.java',
        module: 'android.app.SharedPreferencesImpl$EditorImpl$1',
        package: null,
        platform: null,
        instructionAddr: null,
        symbolAddr: null,
        function: 'run',
        rawFunction: null,
        symbol: null,
        context: [],
        lineNo: 366,
        colNo: null,
        inApp: false,
        trust: null,
        vars: null,
      },
    ]);
    const rootCause = analyzeFramesForRootCause(event);
    expect(rootCause?.resources).toBe(
      'SharedPreferences.apply will save data on background thread only if it happens before the activity/service finishes. Switch to SharedPreferences.commit and move commit to a background thread.'
    );
    expect(rootCause?.culprit).toBe(
      '/^android\\.app\\.SharedPreferencesImpl\\$EditorImpl\\$[0-9]/'
    );
  });

  it('given lock address returns frame with matching lock address', function () {
    const frame1 = {
      filename: 'Instrumentation.java',
      absPath: 'Instrumentation.java',
      module: 'android.app.Instrumentation',
      package: null,
      platform: null,
      instructionAddr: null,
      symbolAddr: null,
      function: 'call',
      rawFunction: null,
      symbol: null,
      context: [],
      lineNo: 1176,
      colNo: null,
      inApp: false,
      trust: null,
      vars: null,
      lock: {
        type: LockType.BLOCKED,
        address: '0x08a8651c',
        package_name: 'io.sentry.samples',
        class_name: 'Monitor',
        thread_id: 12,
      },
    };
    const frame2 = {
      filename: 'MainActivity.java',
      absPath: 'MainActivity.java',
      module: 'com.example.MainActivity',
      package: null,
      platform: null,
      instructionAddr: null,
      symbolAddr: null,
      function: 'onCreate',
      rawFunction: null,
      symbol: null,
      context: [],
      lineNo: 128,
      colNo: null,
      inApp: false,
      trust: null,
      vars: null,
      lock: {
        type: LockType.BLOCKED,
        address: '0x07d7437b',
        package_name: 'java.lang',
        class_name: 'Object',
        thread_id: 7,
      },
    };
    const rootCause1 = analyzeFrameForRootCause(frame1, undefined, '<address>');
    expect(rootCause1).toBeNull();

    const rootCause2 = analyzeFrameForRootCause(frame2, undefined, '0x07d7437b');
    render(<div>{rootCause2?.resources}</div>);
    expect(
      screen.getByText(
        textWithMarkupMatcher(
          'The main thread is blocked/waiting, trying to acquire lock 0x07d7437b (java.lang.Object) held by the suspect frame of this thread.'
        )
      )
    ).toBeInTheDocument();
  });

  it('when thread id is not provided, does not append "held by"', function () {
    const frame = {
      filename: 'MainActivity.java',
      absPath: 'MainActivity.java',
      module: 'com.example.MainActivity',
      package: null,
      platform: null,
      instructionAddr: null,
      symbolAddr: null,
      function: 'onCreate',
      rawFunction: null,
      symbol: null,
      context: [],
      lineNo: 128,
      colNo: null,
      inApp: false,
      trust: null,
      vars: null,
      lock: {
        type: LockType.BLOCKED,
        address: '0x07d7437b',
        package_name: 'java.lang',
        class_name: 'Object',
      },
    };
    const rootCause2 = analyzeFrameForRootCause(frame, undefined, '0x07d7437b');
    render(<div>{rootCause2?.resources}</div>);
    expect(
      screen.getByText(
        textWithMarkupMatcher(
          'The main thread is blocked/waiting, trying to acquire lock 0x07d7437b (java.lang.Object) .'
        )
      )
    ).toBeInTheDocument();
  });

  it('given main thread is locked returns it as root cause', function () {
    const frame = {
      filename: 'MainActivity.java',
      absPath: 'MainActivity.java',
      module: 'com.example.MainActivity',
      package: null,
      platform: null,
      instructionAddr: null,
      symbolAddr: null,
      function: 'onCreate',
      rawFunction: null,
      symbol: null,
      context: [],
      lineNo: 128,
      colNo: null,
      inApp: false,
      trust: null,
      vars: null,
      lock: {
        type: LockType.BLOCKED,
        address: '0x08a1321b',
        package_name: 'java.lang',
        class_name: 'Object',
        thread_id: 7,
      },
    };
    const thread = {
      id: 13920,
      current: true,
      crashed: true,
      name: 'puma 002',
      stacktrace: null,
      rawStacktrace: null,
      state: 'BLOCKED',
    };
    const rootCause = analyzeFrameForRootCause(frame, thread);

    render(<div>{rootCause?.resources}</div>);
    expect(
      screen.getByText(
        textWithMarkupMatcher(
          'The main thread is blocked/waiting, trying to acquire lock 0x08a1321b (java.lang.Object) held by the suspect frame of this thread.'
        )
      )
    ).toBeInTheDocument();
  });
});
