import {EventFixture} from 'sentry-fixture/event';
import {EventEntryFixture} from 'sentry-fixture/eventEntry';

import {EntryType} from 'sentry/types/event';

const exception = EventEntryFixture({
  type: EntryType.EXCEPTION,
  data: {
    values: [
      {
        module: 'example.application',
        type: 'Error',
        value: 'an error occurred',
        stacktrace: {
          frames: [
            {
              function: 'main',
              module: 'example.application',
              lineNo: 1,
              filename: 'application',
              inApp: true,
            },
            {
              function: 'doThing',
              module: 'example.application',
              lineNo: 2,
              filename: 'application',
              inApp: true,
            },
          ],
        },
      },
    ],
  },
});

const message = {
  type: 'message',
  data: {
    formatted: 'Something is broken',
  },
};

const threads = EventEntryFixture({
  type: EntryType.THREADS,
  data: {
    values: [
      {
        module: 'example.application',
        type: 'Error',
        value: 'an error occurred',
        stacktrace: {
          frames: [
            {
              function: 'main',
              module: 'example.application',
              lineNo: 1,
              filename: 'application',
              inApp: true,
            },
            {
              function: 'doThing',
              module: 'example.application',
              lineNo: 2,
              filename: 'application',
              inApp: true,
            },
          ],
        },
      },
    ],
  },
});

export function EventStacktraceExceptionFixture(params = {}) {
  return EventFixture({entries: [{...exception}], ...params});
}

export function EventStacktraceMessageFixture(params = {}) {
  return EventFixture({entries: [{...message}], ...params});
}

export function EventStacktraceThreadsFixture(params = {}) {
  return EventFixture({entries: [{...threads}], ...params});
}
