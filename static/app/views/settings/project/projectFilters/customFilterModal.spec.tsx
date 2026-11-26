import {EventFixture} from 'sentry-fixture/event';
import {EventEntryFixture} from 'sentry-fixture/eventEntry';
import {ExceptionValueFixture} from 'sentry-fixture/exceptionValue';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {ProjectFixture} from 'sentry-fixture/project';
import {ReleaseFixture} from 'sentry-fixture/release';

import {act, renderGlobalModal, screen} from 'sentry-test/reactTestingLibrary';

import {EntryType} from 'sentry/types/event';

import {
  getFilterDraftFromEvent,
  getFilterDraftFromRelease,
  openCustomFilterModal,
} from './customFilterModal';

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

describe('getFilterDraftFromRelease', () => {
  it('matches every data type from exactly the release', () => {
    expect(getFilterDraftFromRelease('2.41.0')).toEqual({
      name: 'Release 2.41.0',
      dataType: 'all',
      conditions: 'release:2.41.0',
    });
  });

  it('names the filter after the formatted version but matches the raw one', () => {
    expect(getFilterDraftFromRelease('com.example.app@2.41.0+123')).toEqual({
      name: 'Release 2.41.0 (123)',
      dataType: 'all',
      conditions: 'release:com.example.app@2.41.0+123',
    });
  });

  it('escapes characters that would otherwise widen or break the match', () => {
    expect(getFilterDraftFromRelease('build *nightly* "rc"').conditions).toBe(
      'release:"build \\*nightly\\* \\"rc\\""'
    );
  });
});

describe('openCustomFilterModal', () => {
  const organization = OrganizationFixture();
  const project = ProjectFixture({slug: 'backend'});

  it('introduces a draft from an event', async () => {
    renderGlobalModal({organization});
    act(() =>
      openCustomFilterModal({
        project,
        initialValues: getFilterDraftFromRelease('2.41.0'),
        draftSource: 'event',
      })
    );

    expect(
      await screen.findByText(/The conditions below come from the event/)
    ).toBeInTheDocument();
  });

  it('introduces a draft from a release, naming the project', async () => {
    renderGlobalModal({organization});
    act(() =>
      openCustomFilterModal({
        project,
        initialValues: getFilterDraftFromRelease('2.41.0'),
        draftSource: 'release',
      })
    );

    expect(
      await screen.findByText(
        /The condition below matches the release you were looking at, in backend\./
      )
    ).toBeInTheDocument();
    expect(screen.getByRole('textbox', {name: 'Name'})).toHaveValue('Release 2.41.0');
    expect(screen.getByRole('row', {name: 'release:2.41.0'})).toBeInTheDocument();
  });
});
