import hydrateSpans from 'sentry/utils/replays/hydrateSpans';

const ONE_DAY_MS = 60 * 60 * 24 * 1000;

describe('hydrateSpans', () => {
  it('should set the start & end timestamps, & offsetMs for each span in the list', () => {
    const replayRecord = TestStubs.ReplayRecord({started_at: new Date('2023/12/23')});
    const spans = [
      TestStubs.Replay.MemoryFrame({
        startTimestamp: new Date('2023/12/23'),
        endTimestamp: new Date('2023/12/23 23:00'),
      }),
      TestStubs.Replay.MemoryFrame({
        startTimestamp: new Date('2023/12/24'),
        endTimestamp: new Date('2023/12/24 23:00'),
      }),
      TestStubs.Replay.MemoryFrame({
        startTimestamp: new Date('2023/12/25'),
        endTimestamp: new Date('2023/12/25 23:00'),
      }),
    ];

    expect(hydrateSpans(replayRecord, spans)).toStrictEqual([
      {
        op: 'memory',
        data: {memory: expect.any(Object)},
        description: '',
        startTimestamp: new Date('2023/12/23'),
        endTimestamp: new Date('2023/12/23 23:00'),
        timestampMs: 1703307600000,
        offsetMs: 0,
      },
      {
        op: 'memory',
        data: {memory: expect.any(Object)},
        description: '',
        startTimestamp: new Date('2023/12/24'),
        endTimestamp: new Date('2023/12/24 23:00'),
        timestampMs: 1703307600000 + ONE_DAY_MS,
        offsetMs: ONE_DAY_MS,
      },
      {
        op: 'memory',
        data: {memory: expect.any(Object)},
        description: '',
        startTimestamp: new Date('2023/12/25'),
        endTimestamp: new Date('2023/12/25 23:00'),
        timestampMs: 1703307600000 + ONE_DAY_MS * 2,
        offsetMs: ONE_DAY_MS * 2,
      },
    ]);
  });
});
