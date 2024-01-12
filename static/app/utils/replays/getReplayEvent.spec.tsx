import {ReplayClickFrameFixture} from 'sentry-fixture/replay/replayBreadcrumbFrameData';
import {ReplayRecordFixture} from 'sentry-fixture/replayRecord';

import {
  getNextReplayFrame,
  getPrevReplayFrame,
} from 'sentry/utils/replays/getReplayEvent';
import hydrateBreadcrumbs from 'sentry/utils/replays/hydrateBreadcrumbs';

const mockRRWebFrames = []; // This is only needed for replay.hydrate-error breadcrumbs.

const frames = hydrateBreadcrumbs(
  ReplayRecordFixture({
    started_at: new Date('2022-05-04T19:41:30.00Z'),
  }),
  [
    ReplayClickFrameFixture({
      timestamp: new Date('2022-05-04T19:41:32.002Z'),
      message: 'index 0',
    }),
    ReplayClickFrameFixture({
      timestamp: new Date('2022-05-04T19:47:08.085000Z'),
      message: 'index 1',
    }),
    ReplayClickFrameFixture({
      timestamp: new Date('2022-05-04T19:47:11.086000Z'),
      message: 'index 2',
    }),
    ReplayClickFrameFixture({
      timestamp: new Date('2022-05-04T19:47:52.915000Z'),
      message: 'index 3',
    }),
    ReplayClickFrameFixture({
      timestamp: new Date('2022-05-04T19:47:59.915000Z'),
      message: 'index 4',
    }),
  ],
  mockRRWebFrames
);

const CURRENT_OFFSET_MS = frames[0].offsetMs + 15000;

describe('getNextReplayFrame', () => {
  it('should return the next crumb', () => {
    const result = getNextReplayFrame({
      frames,
      targetOffsetMs: CURRENT_OFFSET_MS,
    });

    expect(result).toEqual(frames[1]);
  });

  it('should return the next crumb when the the list is not sorted', () => {
    const [one, two, three, four, five] = frames;
    const result = getNextReplayFrame({
      frames: [one, four, five, three, two],
      targetOffsetMs: CURRENT_OFFSET_MS,
    });

    expect(result).toEqual(frames[1]);
  });

  it('should return undefined when there are no crumbs', () => {
    const result = getNextReplayFrame({
      frames: [],
      targetOffsetMs: CURRENT_OFFSET_MS,
    });

    expect(result).toBeUndefined();
  });

  it('should return the first crumb when the timestamp is earlier than any crumbs', () => {
    const result = getNextReplayFrame({
      frames,
      targetOffsetMs: -1,
    });

    expect(result).toEqual(frames[0]);
  });

  it('should return undefined when the timestamp is later than any crumbs', () => {
    const result = getNextReplayFrame({
      frames,
      targetOffsetMs: 99999999999,
    });

    expect(result).toBeUndefined();
  });

  it('should return the next frame when a timestamp exactly matches', () => {
    const exactTime = frames[1].offsetMs;
    const result = getNextReplayFrame({
      frames,
      targetOffsetMs: exactTime,
      allowExact: false,
    });

    expect(result).toEqual(frames[2]);
  });

  it('should return the same frame if timestamps exactly match and allowMatch is enabled', () => {
    const exactTime = frames[1].offsetMs;
    const result = getNextReplayFrame({
      frames,
      targetOffsetMs: exactTime,
      allowExact: true,
    });

    expect(result).toEqual(frames[1]);
  });
});

describe('getPrevReplayFrame', () => {
  it('should return the previous crumb', () => {
    const result = getPrevReplayFrame({
      frames,
      targetOffsetMs: CURRENT_OFFSET_MS,
    });

    expect(result).toEqual(frames[0]);
  });

  it('should return the previous crumb when the list is not sorted', () => {
    const [one, two, three, four, five] = frames;
    const result = getPrevReplayFrame({
      frames: [one, four, five, three, two],
      targetOffsetMs: CURRENT_OFFSET_MS,
    });

    expect(result).toEqual(frames[0]);
  });

  it('should return undefined when there are no crumbs', () => {
    const result = getPrevReplayFrame({
      frames: [],
      targetOffsetMs: CURRENT_OFFSET_MS,
    });

    expect(result).toBeUndefined();
  });

  it('should return undefined when the timestamp is earlier than any crumbs', () => {
    const result = getPrevReplayFrame({
      frames,
      targetOffsetMs: -1,
    });

    expect(result).toBeUndefined();
  });

  it('should return the last crumb if timestamp is later than any crumb', () => {
    const result = getPrevReplayFrame({
      frames,
      targetOffsetMs: 99999999999,
    });

    expect(result).toEqual(frames[4]);
  });

  it('should return the prev frame if timestamp exactly matches', () => {
    const exactTime = frames[1].offsetMs;
    const result = getPrevReplayFrame({
      frames,
      targetOffsetMs: exactTime,
      allowExact: false,
    });

    expect(result).toEqual(frames[0]);
  });

  it('should return the same frame if timestamps exactly match and allowExact is enabled', () => {
    const exactTime = frames[1].offsetMs;
    const result = getPrevReplayFrame({
      frames,
      targetOffsetMs: exactTime,
      allowExact: true,
    });

    expect(result).toEqual(frames[1]);
  });
});
