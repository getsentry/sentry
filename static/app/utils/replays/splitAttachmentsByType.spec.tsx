import splitAttachmentsByType from 'sentry/utils/replays/splitAttachmentsByType';

describe('splitAttachmentsByType', () => {
  const testPayload = [
    ...TestStubs.ReplaySegmentInit({timestamp: new Date(1654290037123)}),
    ...TestStubs.ReplaySegmentBreadcrumb({
      timestamp: new Date(1654290037267),
      payload: {
        type: 'default',
        category: 'ui.click',
        message: 'body > div#root > div.App > form',
        data: {nodeId: 44},
      },
    }),
    ...TestStubs.ReplaySegmentSpan({
      timestamp: new Date(1654290034262),
      payload: TestStubs.ReplaySpanPayload({
        op: 'navigation.navigate',
        description: 'http://localhost:3000/',
        startTimestamp: new Date(1654290034262),
        endTimestamp: new Date(1654290034580),
        data: {size: 1150},
      }),
    }),
    ...TestStubs.ReplaySegmentSpan({
      timestamp: new Date(1654290034262.3),
      payload: TestStubs.ReplaySpanPayload({
        op: 'navigation.navigate',
        description: 'http://localhost:3000/',
        startTimestamp: new Date(1654290034262.3),
        endTimestamp: new Date(1654290034580.8),
        data: {size: 1150},
      }),
    }),
  ];

  it('should split attachments by type', () => {
    const {rawBreadcrumbs, rawRRWebEvents, rawNetworkSpans, rawMemorySpans} =
      splitAttachmentsByType(testPayload);
    expect(rawBreadcrumbs.length).toBe(1);
    expect(rawRRWebEvents.length).toBe(3);
    expect(rawNetworkSpans.length).toBe(2);
    expect(rawMemorySpans.length).toBe(0);
  });
});
