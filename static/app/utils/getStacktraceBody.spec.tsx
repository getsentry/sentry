import {EventFixture} from 'sentry-fixture/event';
import {
  EventStacktraceExceptionFixture,
  EventStacktraceMessageFixture,
  EventStacktraceThreadsFixture,
} from 'sentry-fixture/eventStacktraceException';

import getStacktraceBody from 'sentry/utils/getStacktraceBody';

describe('getStacktraceBody', () => {
  const eventException = EventStacktraceExceptionFixture({platform: 'python'});
  const eventMessage = EventStacktraceMessageFixture({platform: 'python'});
  const eventThreads = EventStacktraceThreadsFixture({platform: 'python'});

  it('formats with an exception', () => {
    const result = getStacktraceBody({event: eventException});
    expect(result).toEqual([
      `Traceback (most recent call last):
  File "application", line 1, in main
  File "application", line 2, in doThing
Error: an error occurred`,
    ]);
  });

  it('formats with a message', () => {
    const result = getStacktraceBody({event: eventMessage});
    expect(result).toEqual(['Something is broken']);
  });

  it('formats with a thread', () => {
    const result = getStacktraceBody({event: eventThreads});
    expect(result).toEqual([
      `Traceback (most recent call last):
  File "application", line 1, in main
  File "application", line 2, in doThing
Error: an error occurred`,
    ]);
  });

  it('returns empty array for empty event entries', () => {
    const result = getStacktraceBody({event: EventFixture({entries: []})});
    expect(result).toEqual([]);
  });
});
