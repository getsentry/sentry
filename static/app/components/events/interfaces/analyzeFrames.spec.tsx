import {analyzeFramesForRootCause} from 'sentry/components/events/interfaces/analyzeFrames';
import {EntryType, Event, EventOrGroupType, Frame} from 'sentry/types/event';

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
                    errors: null,
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
      display_title_with_tree_label: false,
      filename: 'sentry/controllers/welcome_controller.rb',
      finest_tree_label: [
        {filebase: 'welcome_controller.rb', function: '/'},
        {filebase: 'welcome_controller.rb', function: 'index'},
      ],
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
      id: 'mobile:2021-02-12',
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
        errors: null,
        vars: null,
      },
    ]);
    const rootCause = analyzeFramesForRootCause(event);
    expect(rootCause?.resources).toEqual(
      'Switch to SharedPreferences.commit and move commit to a background thread.'
    );
    expect(rootCause?.culprit).toEqual(
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
        errors: null,
        vars: null,
      },
    ]);
    const rootCause = analyzeFramesForRootCause(event);
    expect(rootCause?.resources).toEqual('Move database operations off the main thread.');
    expect(rootCause?.culprit).toEqual('android.database.sqlite.SQLiteConnection');
  });
});
