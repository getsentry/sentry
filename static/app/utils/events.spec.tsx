import {GroupFixture} from 'sentry-fixture/group';

import type {EventMetadata} from 'sentry/types/event';
import {EventOrGroupType} from 'sentry/types/event';
import {getTitle} from 'sentry/utils/events';

describe('getTitle', () => {
  const errorGroup = (metadata: EventMetadata) =>
    GroupFixture({type: EventOrGroupType.ERROR, culprit: 'CrashCapture', metadata});

  it('prefers the exception type', () => {
    expect(getTitle(errorGroup({type: 'ValueError', function: 'doThing'})).title).toBe(
      'ValueError'
    );
  });

  it('falls back to the crash location when there is no type', () => {
    expect(getTitle(errorGroup({function: 'doThing'})).title).toBe('doThing');
  });

  // A synthetic exception is one the SDK fabricated to carry a stacktrace, so its type is a
  // platform label (`SIGSEGV`) rather than the identity of what went wrong. The order flips.
  it('prefers the crash location for a synthetic exception', () => {
    expect(
      getTitle(errorGroup({type: 'SIGSEGV', function: 'ForceCrash', synthetic: true}))
        .title
    ).toBe('ForceCrash');
  });

  it('falls back to the type for a synthetic exception that did not symbolicate', () => {
    expect(getTitle(errorGroup({type: 'SIGSEGV', synthetic: true})).title).toBe(
      'SIGSEGV'
    );
  });

  it('has something to show when a synthetic exception has neither', () => {
    expect(getTitle(errorGroup({synthetic: true})).title).toBe('<unknown>');
  });

  // Groups stored before the server recorded `synthetic` have no such key, so they must keep
  // taking the original branch.
  it('leaves metadata without the flag alone', () => {
    expect(getTitle(errorGroup({function: 'ForceCrash'})).title).toBe('ForceCrash');
  });
});
