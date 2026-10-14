import {EventFixture} from 'sentry-fixture/event';
import {EventEntryFixture} from 'sentry-fixture/eventEntry';
import {ExceptionValueFixture} from 'sentry-fixture/exceptionValue';
import {ReleaseFixture} from 'sentry-fixture/release';

import {EntryType} from 'sentry/types/event';
import {getFilterDraftFromEvent} from 'sentry/views/settings/project/projectFilters/customFilterModal';

describe('getFilterDraftFromEvent', () => {
  it('fills one condition per property the event carries', () => {
    const event = EventFixture({
      title: 'TypeError: x is undefined',
      release: ReleaseFixture({version: '2.41.0'}),
      user: {ip_address: '203.0.113.7', geo: {country_code: 'US'}},
      entries: [
        EventEntryFixture({
          type: EntryType.EXCEPTION,
          data: {
            values: [
              ExceptionValueFixture({type: 'ValueError', value: 'bad input'}),
              ExceptionValueFixture({type: 'TypeError', value: 'x is undefined'}),
            ],
          },
        }),
      ],
    });

    expect(getFilterDraftFromEvent(event)).toEqual({
      name: 'TypeError: x is undefined',
      dataType: 'error',
      conditions: [
        {property: 'error_type', value: 'ValueError\nTypeError'},
        {property: 'error_message', value: 'bad input\nx is undefined'},
        {property: 'geo_country_code', value: 'US'},
        {property: 'release', value: '2.41.0'},
        {property: 'ip_address', value: '203.0.113.7'},
      ],
    });
  });

  it('prefers the raw exception type and message over the symbolicated ones', () => {
    const event = EventFixture({
      entries: [
        EventEntryFixture({
          type: EntryType.EXCEPTION,
          data: {
            values: [
              ExceptionValueFixture({
                type: 'IllegalStateException',
                value: 'Fragment not attached',
                rawType: 'a.b.c',
                rawValue: 'f',
              }),
            ],
          },
        }),
      ],
    });

    expect(getFilterDraftFromEvent(event).conditions).toEqual([
      {property: 'error_type', value: 'a.b.c'},
      {property: 'error_message', value: 'f'},
    ]);
  });

  it('escapes glob characters and folds line breaks into a wildcard', () => {
    const event = EventFixture({
      entries: [
        EventEntryFixture({
          type: EntryType.EXCEPTION,
          data: {
            values: [
              ExceptionValueFixture({
                type: 'Error',
                value: 'Invalid value {a,b}: [*] ?\n  at file.js',
              }),
            ],
          },
        }),
      ],
    });

    expect(getFilterDraftFromEvent(event).conditions).toEqual([
      {property: 'error_type', value: 'Error'},
      {
        property: 'error_message',
        value: 'Invalid value \\{a,b\\}: \\[\\*\\] \\?*at file.js',
      },
    ]);
  });

  it('matches the log message of an event without an exception', () => {
    const event = EventFixture({
      entries: [{type: EntryType.MESSAGE, data: {formatted: 'Payment declined'}}],
    });

    expect(getFilterDraftFromEvent(event).conditions).toEqual([
      {property: 'error_message', value: 'Payment declined'},
    ]);
  });

  it('starts with an empty condition when the event carries nothing to match', () => {
    expect(getFilterDraftFromEvent(EventFixture()).conditions).toEqual([
      {property: 'error_message', value: ''},
    ]);
  });
});
