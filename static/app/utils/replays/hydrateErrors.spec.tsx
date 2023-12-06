import {RawReplayErrorFixture} from 'sentry-fixture/replay/error';
import {ReplayRecordFixture} from 'sentry-fixture/replayRecord';

import hydrateErrors from 'sentry/utils/replays/hydrateErrors';

const ONE_DAY_MS = 60 * 60 * 24 * 1000;

describe('hydrateErrors', () => {
  const replayRecord = ReplayRecordFixture({started_at: new Date('2023/12/23')});

  it('should set the timestamp & offsetMs for each span in the list', () => {
    const errors = [
      RawReplayErrorFixture({timestamp: new Date('2023/12/23')}),
      RawReplayErrorFixture({timestamp: new Date('2023/12/24')}),
      RawReplayErrorFixture({timestamp: new Date('2023/12/25')}),
    ];

    expect(hydrateErrors(replayRecord, errors)).toStrictEqual([
      {
        category: 'issue',
        data: {
          eventId: 'e123',
          groupId: 3740335939,
          groupShortId: 'JS-374',
          label: '',
          labels: [],
          projectSlug: 'javascript',
        },
        message: 'A Redirect with :orgId param on customer domain',
        offsetMs: 0,
        timestamp: new Date('2023/12/23'),
        timestampMs: 1703307600000,
        type: 'error',
      },
      {
        category: 'issue',
        data: {
          eventId: 'e123',
          groupId: 3740335939,
          groupShortId: 'JS-374',
          label: '',
          labels: [],
          projectSlug: 'javascript',
        },
        message: 'A Redirect with :orgId param on customer domain',
        offsetMs: ONE_DAY_MS,
        timestamp: new Date('2023/12/24'),
        timestampMs: 1703307600000 + ONE_DAY_MS,
        type: 'error',
      },
      {
        category: 'issue',
        data: {
          eventId: 'e123',
          groupId: 3740335939,
          groupShortId: 'JS-374',
          label: '',
          labels: [],
          projectSlug: 'javascript',
        },
        message: 'A Redirect with :orgId param on customer domain',
        offsetMs: ONE_DAY_MS * 2,
        timestamp: new Date('2023/12/25'),
        timestampMs: 1703307600000 + ONE_DAY_MS * 2,
        type: 'error',
      },
    ]);
  });

  it('should drop errors that cannot be parsed', () => {
    const errors = [{foo: 'bar'}];

    // @ts-expect-error: Explicitly test invalid input
    expect(hydrateErrors(replayRecord, errors)).toStrictEqual([]);
  });
});
