import {
  ReplayConsoleEventFixture,
  ReplayMemoryEventFixture,
} from 'sentry-fixture/replay/helpers';
import {
  ReplayOptionFrameEventFixture,
  ReplayOptionFrameFixture,
} from 'sentry-fixture/replay/replayFrameEvents';
import {RRWebInitFrameEvents} from 'sentry-fixture/replay/rrweb';

import hydrateFrames from 'sentry/utils/replays/hydrateFrames';

describe('hydrateFrames', () => {
  it('should split breadcrumbs, spans, option and rrweb frames apart', () => {
    const crumbProps = {timestamp: new Date()};
    const spanProps = {startTimestamp: new Date(), endTimestamp: new Date()};

    const optionsFrame = ReplayOptionFrameFixture({});
    const attachments = [
      ...RRWebInitFrameEvents(crumbProps),
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
});
