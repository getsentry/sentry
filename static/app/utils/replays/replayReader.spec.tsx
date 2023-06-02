import {EventType} from '@sentry-internal/rrweb';

import ReplayReader from 'sentry/utils/replays/replayReader';

describe('ReplayReader', () => {
  const replayRecord = TestStubs.ReplayRecord({});

  it('Should return null if there are missing arguments', () => {
    const missingAttachments = ReplayReader.factory({
      frames: undefined,
      errors: [],
      replayRecord,
    });
    expect(missingAttachments).toBeNull();

    const missingErrors = ReplayReader.factory({
      frames: [],
      errors: undefined,
      replayRecord,
    });
    expect(missingErrors).toBeNull();

    const missingRecord = ReplayReader.factory({
      frames: [],
      errors: [],
      replayRecord: undefined,
    });
    expect(missingRecord).toBeNull();
  });

  it('should calculate started_at/finished_at/duration based on first/last events', () => {
    const minuteZero = new Date('2023-12-25T00:00:00');
    const minuteTen = new Date('2023-12-25T00:10:00');

    const replay = ReplayReader.factory({
      frames: [
        ...TestStubs.ReplaySegmentConsole({timestamp: minuteZero}),
        ...TestStubs.ReplaySegmentConsole({timestamp: minuteTen}),
      ],
      errors: [],
      replayRecord: TestStubs.ReplayRecord({
        started_at: new Date('2023-12-25T00:01:00'),
        finished_at: new Date('2023-12-25T00:09:00'),
        duration: undefined, // will be calculated
      }),
    });

    const expectedDuration = 10 * 60 * 1000; // 10 minutes, in ms
    expect(replay?.getReplay().started_at).toEqual(minuteZero);
    expect(replay?.getReplay().finished_at).toEqual(minuteTen);
    expect(replay?.getReplay().duration.asMilliseconds()).toEqual(expectedDuration);
    expect(replay?.getDurationMs()).toEqual(expectedDuration);
  });

  it('should make the replayRecord available through a getter method', () => {
    const replay = ReplayReader.factory({
      frames: [],
      errors: [],
      replayRecord,
    });

    expect(replay?.getReplay()).toEqual(replayRecord);
  });

  it('should make rrwebEvents accessible', () => {
    const firstDiv = TestStubs.ReplayRRWebDivHelloWorld();
    const secondDiv = TestStubs.ReplayRRWebDivHelloWorld();
    const endDiv = {
      type: EventType.Custom,
      timestamp: replayRecord.finished_at.getTime(),
      data: {
        tag: 'replay-end',
      },
    };

    const replay = ReplayReader.factory({
      frames: [
        ...TestStubs.ReplaySegmentConsole({timestamp: new Date()}),
        firstDiv,
        secondDiv,
      ],
      errors: [],
      replayRecord,
    });

    expect(replay?.getRRWebEvents()).toStrictEqual([firstDiv, secondDiv, endDiv]);
  });

  it('should make crumbs that point to rrweb nodes available', () => {
    const div = TestStubs.ReplayRRWebDivHelloWorld();
    const consoleFrames = TestStubs.ReplaySegmentConsole({timestamp: new Date()});
    const framesWithNode = TestStubs.ReplaySegmentBreadcrumb({
      timestamp: new Date(),
      payload: {
        payload: {
          nodeId: 1,
        },
      },
    });

    const replay = ReplayReader.factory({
      frames: [div, ...framesWithNode, ...consoleFrames],
      errors: [],
      replayRecord,
    });

    expect(replay?.getCrumbsWithRRWebNodes()).toStrictEqual([framesWithNode]);
  });
});
