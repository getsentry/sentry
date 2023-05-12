import {
  breadcrumbFactory,
  isMemorySpan,
  isNetworkSpan,
  mapRRWebAttachments,
  rrwebEventListFactory,
} from 'sentry/utils/replays/replayDataUtils';
import type {ReplayRecord} from 'sentry/views/replays/types';

const fooSpan = TestStubs.ReplaySpanPayload({
  op: 'foo',
  data: {},
});
const lcpSpan = TestStubs.ReplaySpanPayload({
  op: 'largest-contentful-paint',
  data: {
    nodeId: 2,
  },
});
const navigateSpan = TestStubs.ReplaySpanPayload({
  op: 'navigation.navigate',
  description: 'http://test.com',
});
const cssSpan = TestStubs.ReplaySpanPayload({
  op: 'resource.css',
  description: 'http://test.com/static/media/glyphicons-halflings-regular.448c34a5.woff2',
});
const memorySpan = TestStubs.ReplaySpanPayload({
  op: 'memory',
  description: 'memory',
  data: {
    jsHeapSizeLimit: 4294705152,
    totalJSHeapSize: 19203353,
    usedJSHeapSize: 16119217,
  },
});

describe('breadcrumbFactory', () => {
  it('adds LCP as a breadcrumb', () => {
    const rawSpans = [fooSpan, lcpSpan];

    const results = breadcrumbFactory(
      TestStubs.Event({
        started_at: new Date(0),
      }),
      [],
      [],
      rawSpans
    );

    expect(results).toMatchInlineSnapshot(`
      [
        {
          "color": "gray300",
          "data": {
            "action": "replay-init",
            "label": "Start recording",
            "url": undefined,
          },
          "description": "Default",
          "id": 0,
          "level": "info",
          "message": undefined,
          "timestamp": "1970-01-01T00:00:00.000Z",
          "type": "init",
        },
        {
          "category": "default",
          "color": "purple300",
          "data": {
            "action": "largest-contentful-paint",
            "label": "LCP",
            "nodeId": 2,
          },
          "description": "Debug",
          "id": 1,
          "level": "info",
          "timestamp": "2017-10-17T02:41:20.000Z",
          "type": "debug",
        },
      ]
    `);
  });

  it('adds navigation as a breadcrumb', () => {
    const rawSpans = [fooSpan, navigateSpan];

    const results = breadcrumbFactory(
      TestStubs.Event({
        started_at: new Date(0),
      }),
      [],
      [],
      rawSpans
    );

    expect(results).toMatchInlineSnapshot(`
      [
        {
          "action": "navigate",
          "category": "default",
          "color": "green300",
          "data": {
            "label": "Page load",
            "to": "http://test.com",
          },
          "description": "Navigation",
          "id": 0,
          "level": "info",
          "message": "http://test.com",
          "timestamp": "2017-10-17T02:41:20.000Z",
          "type": "navigation",
        },
      ]
    `);
  });

  it('sorts breadcrumbs by timestamp', () => {
    const rawSpans = [
      TestStubs.ReplaySpanPayload({
        ...navigateSpan,
        endTimestamp: new Date(31),
        startTimestamp: new Date(30),
      }),
      TestStubs.ReplaySpanPayload({
        ...lcpSpan,
        endTimestamp: new Date(11),
        startTimestamp: new Date(10),
      }),
      TestStubs.ReplaySpanPayload({
        ...navigateSpan,
        endTimestamp: new Date(41),
        startTimestamp: new Date(40),
      }),
      TestStubs.ReplaySpanPayload({
        ...navigateSpan,
        endTimestamp: new Date(21),
        startTimestamp: new Date(20),
      }),
    ];

    const results = breadcrumbFactory(
      TestStubs.Event({
        started_at: new Date(0),
      }),
      [],
      [],
      rawSpans
    );

    function toTime(input: string | undefined) {
      return new Date(input || '').getTime();
    }

    expect(results).toHaveLength(4);
    expect(toTime(results[0].timestamp)).toBeLessThan(toTime(results[1].timestamp));
    expect(toTime(results[1].timestamp)).toBeLessThan(toTime(results[2].timestamp));
    expect(toTime(results[2].timestamp)).toBeLessThan(toTime(results[3].timestamp));
  });
});

describe('isMemorySpan', () => {
  it('should identify memory spans by the op field', () => {
    expect(isMemorySpan(memorySpan)).toBeTruthy();
  });

  it('should reject spans which are not op=memory', () => {
    expect(isMemorySpan(cssSpan)).toBeFalsy();
    expect(isMemorySpan(fooSpan)).toBeFalsy();
    expect(isMemorySpan(lcpSpan)).toBeFalsy();
    expect(isMemorySpan(navigateSpan)).toBeFalsy();
  });
});

describe('isNetworkSpan', () => {
  it('should identify network spans by the op field', () => {
    expect(isNetworkSpan(cssSpan)).toBeTruthy();
    expect(isNetworkSpan(navigateSpan)).toBeTruthy();
  });

  it('should reject spans which are not some kind of op=navigation', () => {
    expect(isNetworkSpan(fooSpan)).toBeFalsy();
    expect(isNetworkSpan(lcpSpan)).toBeFalsy();
    expect(isNetworkSpan(memorySpan)).toBeFalsy();
  });
});

describe('rrwebEventListFactory', () => {
  it('returns a list of replay events for highlights', function () {
    const replayRecord = {
      started_at: new Date(13),
      finished_at: new Date(213),
    } as ReplayRecord;

    const results = rrwebEventListFactory(replayRecord, []);

    expect(results).toMatchInlineSnapshot(`
      [
        {
          "data": {
            "tag": "replay-end",
          },
          "timestamp": 13,
          "type": 5,
        },
      ]
    `);
  });

  it('merges and sorts rrweb-events and span data', function () {
    const startTimestampMs = 0;
    const endTimestampMs = 10_000;

    const replayRecord = {
      started_at: new Date(startTimestampMs),
      finished_at: new Date(endTimestampMs),
    } as ReplayRecord;

    expect(
      rrwebEventListFactory(replayRecord, [
        {type: 0, timestamp: 5_000, data: {}},
        {type: 1, timestamp: 1_000, data: {}},
        {type: 2, timestamp: 3_000, data: {} as any},
      ])
    ).toEqual([
      {type: 1, timestamp: 0, data: {}},
      {type: 2, timestamp: 3_000, data: {}},
      {type: 0, timestamp: 5_000, data: {}},
      {type: 5, timestamp: 10_000, data: {tag: 'replay-end'}},
    ]);
  });
});

describe('mapRRWebAttachments', () => {
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
    const {breadcrumbs, rrwebEvents, spans} = mapRRWebAttachments(testPayload);
    expect(breadcrumbs.length).toBe(1);
    expect(rrwebEvents.length).toBe(3);
    expect(spans.length).toBe(2);
  });
});
