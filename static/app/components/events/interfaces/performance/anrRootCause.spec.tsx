import {initializeOrg} from 'sentry-test/initializeOrg';
import {render, screen} from 'sentry-test/reactTestingLibrary';
import {textWithMarkupMatcher} from 'sentry-test/utils';

import {AnrRootCause} from 'sentry/components/events/interfaces/performance/anrRootCause';
import {EntryType, Event, EventOrGroupType, LockType, Thread} from 'sentry/types';

const makeEventWithThreads = (threads: Thread[]): Event => {
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
              id: 1,
              current: true,
              crashed: true,
              name: 'main',
              stacktrace: {
                frames: [
                  {
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
                  },
                ],
                framesOmitted: null,
                registers: null,
                hasSystemFrames: true,
              },
              rawStacktrace: null,
              state: 'BLOCKED',
            },
            ...threads,
          ],
        },
        type: EntryType.THREADS,
      },
      {
        data: {
          values: [
            {
              type: 'ApplicationNotResponding',
              value: 'ANR',
              mechanism: null,
              threadId: 1,
              module: 'com.example.MainActivity',
              stacktrace: {
                frames: [
                  {
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
                  },
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

describe('anrRootCause', function () {
  it('displays stacktrace of the offending thread', function () {
    const event = makeEventWithThreads([
      {
        id: 7,
        current: false,
        crashed: false,
        name: 'HangingThread',
        stacktrace: {
          frames: [
            {
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
              lineNo: 366,
              colNo: null,
              inApp: false,
              trust: null,
              vars: null,
              lock: {
                type: LockType.WAITING,
                address: '0x08a1321b',
                package_name: 'java.lang',
                class_name: 'Object',
              },
            },
            {
              filename: 'Thread.java',
              absPath: 'Thread.java',
              module: 'java.lang.Thread',
              package: null,
              platform: null,
              instructionAddr: null,
              symbolAddr: null,
              function: 'wait',
              rawFunction: null,
              symbol: null,
              context: [],
              lineNo: 10,
              colNo: null,
              inApp: false,
              trust: null,
              vars: null,
            },
          ],
          framesOmitted: null,
          registers: null,
          hasSystemFrames: true,
        },
        rawStacktrace: null,
        state: 'WAITING',
      },
    ]);
    const {organization} = initializeOrg();
    const org = {...organization, features: ['anr-analyze-frames']};
    render(<AnrRootCause event={event} organization={org} />);

    expect(
      screen.getByText(
        textWithMarkupMatcher(
          'The main thread is blocked/waiting, trying to acquire lock 0x08a1321b (java.lang.Object) held by the suspect frame of this thread.'
        )
      )
    ).toBeInTheDocument();
    expect(screen.getByTestId('stack-trace-content')).toBeInTheDocument();
    expect(
      screen.getByText(textWithMarkupMatcher('Thread.java in wait at line 10'))
    ).toBeInTheDocument();
    expect(
      screen.getByText(textWithMarkupMatcher('MainActivity.java in onCreate at line 366'))
    ).toBeInTheDocument();
  });
});
