import {EventFixture} from 'sentry-fixture/event';
import {EventEntryFixture} from 'sentry-fixture/eventEntry';
import {ExceptionValueFixture} from 'sentry-fixture/exceptionValue';
import {ReleaseFixture} from 'sentry-fixture/release';

import {EntryType} from 'sentry/types/event';

import {getFilterDraftFromEvent} from './customFilterModal';

describe('getFilterDraftFromEvent', () => {
  it('fills one literal condition per property the event carries', () => {
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
      conditions:
        'error_type:[ValueError,TypeError] error_message:["bad input","x is undefined"] geo_country_code:US release:2.41.0 ip_address:203.0.113.7',
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

    expect(getFilterDraftFromEvent(event).conditions).toBe(
      'error_type:a.b.c error_message:f'
    );
  });

  it('turns a value with line breaks into a glob with a wildcard per break', () => {
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

    expect(getFilterDraftFromEvent(event).conditions).toBe(
      'error_type:Error error_message:"Invalid value \\{a,b\\}: \\[\\*\\] \\?*at file.js"'
    );
  });

  it('matches the log message of an event without an exception', () => {
    const event = EventFixture({
      entries: [{type: EntryType.MESSAGE, data: {formatted: 'Payment declined'}}],
    });

    expect(getFilterDraftFromEvent(event).conditions).toBe(
      'error_message:"Payment declined"'
    );
  });

  it('starts with no conditions when the event carries nothing to match', () => {
    expect(getFilterDraftFromEvent(EventFixture()).conditions).toBe('');
  });
});
