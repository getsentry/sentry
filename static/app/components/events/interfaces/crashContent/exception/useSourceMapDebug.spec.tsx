import cloneDeep from 'lodash/cloneDeep';
import {EventStacktraceExceptionFixture} from 'sentry-fixture/eventStacktraceException';

import type {EntryException, Event} from 'sentry/types/event';

import {getUniqueFilesFromException} from './useSourceMapDebug';

function modifyEventFrames(event: Event, modify: any): Event {
  const modifiedEvent = cloneDeep(event);
  modifiedEvent.entries[0]!.data.values[0].stacktrace.frames =
    event.entries[0]!.data.values[0].stacktrace.frames.map((frame: any) => ({
      ...frame,
      ...modify,
    }));
  return modifiedEvent;
}

describe('getUniqueFilesFromException', () => {
  const props = {eventId: '0', orgSlug: '0', projectSlug: '0'};

  it('returns an array of frame filenames with required props', function () {
    const event = EventStacktraceExceptionFixture({
      platform: 'javascript',
    });
    const result = getUniqueFilesFromException(
      (event.entries as EntryException[])[0]!.data.values!,
      props
    );

    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      filename: 'application',
      query: {
        eventId: '0',
        exceptionIdx: 0,
        frameIdx: 1,
        orgSlug: '0',
        projectSlug: '0',
      },
    });
  });

  it('does NOT use frames if all filenames are anonymous', function () {
    const event = modifyEventFrames(
      EventStacktraceExceptionFixture({
        platform: 'javascript',
      }),
      {filename: '<anonymous>'}
    );
    const result = getUniqueFilesFromException(
      (event.entries as EntryException[])[0]!.data.values!,
      props
    );

    expect(result).toHaveLength(0);
  });

  it('uses frames that are relative to home directory', function () {
    const event = modifyEventFrames(
      EventStacktraceExceptionFixture({
        platform: 'javascript',
      }),
      {absPath: '~/myfile.js', filename: '~/myfile.js'}
    );
    const result = getUniqueFilesFromException(
      (event.entries as EntryException[])[0]!.data.values!,
      props
    );

    expect(result).toHaveLength(1);
  });
});
