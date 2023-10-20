import {ReplayConsoleEvent, ReplayMemoryEvent} from 'sentry-fixture/replay/helpers';
import {
  ReplayOptionFrame,
  ReplayOptionFrameEvent,
} from 'sentry-fixture/replay/replayFrameEvents';

import hydrateFrames from 'sentry/utils/replays/hydrateFrames';

describe('hydrateFrames', () => {
  it('should split breadcrumbs, spans, option and rrweb frames apart', () => {
    const crumbProps = {timestamp: new Date()};
    const spanProps = {startTimestamp: new Date(), endTimestamp: new Date()};

    const optionsFrame = ReplayOptionFrame({});
    const attachments = [
      ...TestStubs.Replay.RRWebInitFrameEvents(crumbProps),
      ReplayOptionFrameEvent({
        timestamp: new Date(),
        data: {payload: optionsFrame},
      }),
      ReplayConsoleEvent(crumbProps),
      ReplayConsoleEvent(crumbProps),
      ReplayMemoryEvent(spanProps),
      ReplayMemoryEvent(spanProps),
      ReplayMemoryEvent(spanProps),
      ReplayMemoryEvent(spanProps),
    ];

    const {breadcrumbFrames, optionFrame, rrwebFrames, spanFrames} =
      hydrateFrames(attachments);

    expect(breadcrumbFrames).toHaveLength(2);
    expect(optionFrame).toStrictEqual(optionsFrame);
    expect(rrwebFrames).toHaveLength(3);
    expect(spanFrames).toHaveLength(4);
  });
});
