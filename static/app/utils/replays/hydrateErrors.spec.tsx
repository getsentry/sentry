import hydrateErrors from 'sentry/utils/replays/hydrateErrors';

const ONE_DAY_MS = 60 * 60 * 24 * 1000;

describe('hydrateErrors', () => {
  it('should set the timestamp & offsetMS for each span in the list', () => {
    const replayRecord = TestStubs.ReplayRecord({started_at: new Date('2023/12/23')});
    const errors = [
      TestStubs.Replay.RawReplayError({timestamp: new Date('2023/12/23')}),
      TestStubs.Replay.RawReplayError({timestamp: new Date('2023/12/24')}),
      TestStubs.Replay.RawReplayError({timestamp: new Date('2023/12/25')}),
    ];

    expect(hydrateErrors(replayRecord, errors)).toStrictEqual([
      {
        category: 'issue',
        data: {
          eventId: 'e123',
          groupId: 3740335939,
          groupShortId: 'JS-374',
          label: '',
          projectSlug: 'javascript',
        },
        message: 'A Redirect with :orgId param on customer domain',
        offsetMS: 0,
        timestamp: new Date('2023/12/23'),
        timestampMS: 1703307600000,
        type: 'error',
      },
      {
        category: 'issue',
        data: {
          eventId: 'e123',
          groupId: 3740335939,
          groupShortId: 'JS-374',
          label: '',
          projectSlug: 'javascript',
        },
        message: 'A Redirect with :orgId param on customer domain',
        offsetMS: ONE_DAY_MS,
        timestamp: new Date('2023/12/24'),
        timestampMS: 1703307600000 + ONE_DAY_MS,
        type: 'error',
      },
      {
        category: 'issue',
        data: {
          eventId: 'e123',
          groupId: 3740335939,
          groupShortId: 'JS-374',
          label: '',
          projectSlug: 'javascript',
        },
        message: 'A Redirect with :orgId param on customer domain',
        offsetMS: ONE_DAY_MS * 2,
        timestamp: new Date('2023/12/25'),
        timestampMS: 1703307600000 + ONE_DAY_MS * 2,
        type: 'error',
      },
    ]);
  });
});
