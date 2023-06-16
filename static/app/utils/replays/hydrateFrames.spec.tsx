import hydrateFrames from 'sentry/utils/replays/hydrateFrames';

describe('hydrateFrames', () => {
  it('should split breadcrumbs, spans, option and rrweb frames apart', () => {
    const crumbProps = {timestamp: new Date()};
    const spanProps = {startTimestamp: new Date(), endTimestamp: new Date()};

    const optionsFrame = TestStubs.Replay.OptionFrame({});
    const attachments = [
      ...TestStubs.Replay.RRWebInitFrameEvents(crumbProps),
      TestStubs.Replay.OptionFrameEvent({
        timestamp: new Date(),
        data: {payload: optionsFrame},
      }),
      TestStubs.Replay.ConsoleEvent(crumbProps),
      TestStubs.Replay.ConsoleEvent(crumbProps),
      TestStubs.Replay.MemoryEvent(spanProps),
      TestStubs.Replay.MemoryEvent(spanProps),
      TestStubs.Replay.MemoryEvent(spanProps),
      TestStubs.Replay.MemoryEvent(spanProps),
    ];

    const {breadcrumbFrames, optionFrame, rrwebFrames, spanFrames} =
      hydrateFrames(attachments);

    expect(breadcrumbFrames).toHaveLength(2);
    expect(optionFrame).toStrictEqual(optionsFrame);
    expect(rrwebFrames).toHaveLength(3);
    expect(spanFrames).toHaveLength(4);
  });
});
