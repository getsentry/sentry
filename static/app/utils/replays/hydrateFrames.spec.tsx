import {
  ReplayConsoleEventFixture,
  ReplayMemoryEventFixture,
} from 'sentry-fixture/replay/helpers';
import {
  ReplayOptionFrameEventFixture,
  ReplayOptionFrameFixture,
} from 'sentry-fixture/replay/replayFrameEvents';
import {
  RRWebIncrementalSnapshotFrameEventFixture,
  RRWebInitFrameEventsFixture,
} from 'sentry-fixture/replay/rrweb';

import {hydrateFrames} from 'sentry/utils/replays/hydrateFrames';
import {IncrementalSource} from 'sentry/utils/replays/types';

describe('hydrateFrames', () => {
  it('should split breadcrumbs, spans, option and rrweb frames apart', () => {
    const crumbProps = {timestamp: new Date()};
    const spanProps = {startTimestamp: new Date(), endTimestamp: new Date()};

    const optionsFrame = ReplayOptionFrameFixture();
    const attachments = [
      ...RRWebInitFrameEventsFixture(crumbProps),
      ReplayOptionFrameEventFixture({
        timestamp: new Date(),
        data: {payload: optionsFrame},
      }),
      ReplayConsoleEventFixture(crumbProps),
      ReplayConsoleEventFixture(crumbProps),
      ReplayMemoryEventFixture(spanProps),
      ReplayMemoryEventFixture(spanProps),
      ReplayMemoryEventFixture(spanProps),
      ReplayMemoryEventFixture(spanProps),
    ];

    const {breadcrumbFrames, optionFrame, rrwebFrames, spanFrames} =
      hydrateFrames(attachments);

    expect(breadcrumbFrames).toHaveLength(2);
    expect(optionFrame).toStrictEqual(optionsFrame);
    expect(rrwebFrames).toHaveLength(3);
    expect(spanFrames).toHaveLength(4);
  });

  it('should drop pointer moves without positions', () => {
    const timestamp = new Date();
    const mouseMove = RRWebIncrementalSnapshotFrameEventFixture({
      timestamp,
      data: {
        source: IncrementalSource.MouseMove,
        positions: [{x: 1, y: 2, id: 3, timeOffset: 0}],
      },
    });
    const attachments = [
      ...RRWebInitFrameEventsFixture({timestamp}),
      mouseMove,
      RRWebIncrementalSnapshotFrameEventFixture({
        timestamp,
        data: {source: IncrementalSource.MouseMove, positions: []},
      }),
      RRWebIncrementalSnapshotFrameEventFixture({
        timestamp,
        data: {source: IncrementalSource.TouchMove, positions: []},
      }),
    ];

    const {rrwebFrames} = hydrateFrames(attachments);

    expect(rrwebFrames).toHaveLength(4);
    expect(rrwebFrames).toContain(mouseMove);
  });
});
