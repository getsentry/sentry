import * as Sentry from '@sentry/react';
import {ReplayMemoryFrameFixture} from 'sentry-fixture/replay/replaySpanFrameData';
import {ReplayRecordFixture} from 'sentry-fixture/replayRecord';

import {hydrateSpans} from './hydrateSpans';

const ONE_HOUR_MS = 60 * 60 * 1000;
const ONE_DAY_MS = ONE_HOUR_MS * 24;

describe('hydrateSpans', () => {
  const replayRecord = ReplayRecordFixture({started_at: new Date('2023/12/23')});

  it('should set the start & end timestamps, & offsetMs for each span in the list', () => {
    const spans = [
      ReplayMemoryFrameFixture({
        startTimestamp: new Date('2023/12/23'),
        endTimestamp: new Date('2023/12/23 23:00'),
      }),
      ReplayMemoryFrameFixture({
        startTimestamp: new Date('2023/12/24'),
        endTimestamp: new Date('2023/12/24 23:00'),
      }),
      ReplayMemoryFrameFixture({
        startTimestamp: new Date('2023/12/25'),
        endTimestamp: new Date('2023/12/25 23:00'),
      }),
    ];

    expect(hydrateSpans(replayRecord, spans)).toStrictEqual([
      {
        op: 'memory',
        data: {memory: expect.any(Object)},
        description: '',
        endTimestamp: new Date('2023/12/23 23:00'),
        endTimestampMs: 1703307600000 + ONE_HOUR_MS * 23,
        offsetMs: 0,
        startTimestamp: new Date('2023/12/23'),
        timestampMs: 1703307600000,
      },
      {
        op: 'memory',
        data: {memory: expect.any(Object)},
        description: '',
        endTimestamp: new Date('2023/12/24 23:00'),
        endTimestampMs: 1703307600000 + ONE_DAY_MS + ONE_HOUR_MS * 23,
        offsetMs: ONE_DAY_MS,
        startTimestamp: new Date('2023/12/24'),
        timestampMs: 1703307600000 + ONE_DAY_MS,
      },
      {
        op: 'memory',
        data: {memory: expect.any(Object)},
        description: '',
        endTimestamp: new Date('2023/12/25 23:00'),
        endTimestampMs: 1703307600000 + ONE_DAY_MS * 2 + ONE_HOUR_MS * 23,
        offsetMs: ONE_DAY_MS * 2,
        startTimestamp: new Date('2023/12/25'),
        timestampMs: 1703307600000 + ONE_DAY_MS * 2,
      },
    ]);
  });

  it('should drop spans that cannot be parsed', () => {
    const spans = [{foo: 'bar'}];

    // @ts-expect-error: Explicitly test invalid input
    expect(hydrateSpans(replayRecord, spans)).toStrictEqual([]);
  });

  it('keeps spans without a description and logs which ops were missing one', () => {
    const warn = jest.spyOn(Sentry.logger, 'warn').mockImplementation(() => {});
    const {description: _description, ...span} = ReplayMemoryFrameFixture({
      startTimestamp: new Date('2023/12/23'),
      endTimestamp: new Date('2023/12/23 23:00'),
    });

    const [hydrated] = hydrateSpans(replayRecord, [span]);

    expect(hydrated).toBeDefined();
    expect(hydrated).not.toHaveProperty('description');
    expect(warn).toHaveBeenCalledWith('Replay: span frames are missing description', {
      ops: 'memory',
      sdk_name: replayRecord.sdk.name,
      sdk_version: replayRecord.sdk.version,
    });
    warn.mockRestore();
  });
});
