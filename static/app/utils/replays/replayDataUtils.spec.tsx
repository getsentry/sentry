import {
  breadcrumbFactory,
  isMemorySpan,
  isNetworkSpan,
  // breadcrumbValuesFromEvents,
  rrwebEventListFactory,
  // spanDataFromEvents,
  // spanEntryFactory,
} from 'sentry/utils/replays/replayDataUtils';
import type {ReplayRecord, ReplaySpan} from 'sentry/views/replays/types';

function createSpan(extra: {
  op: string;
  data?: Record<string, any>;
  description?: string;
}): ReplaySpan<Record<string, any>> {
  return {
    data: {},
    endTimestamp: 2,
    id: '0',
    startTimestamp: 1,
    timestamp: 1,
    ...extra,
  };
}

const fooSpan = createSpan({
  op: 'foo',
  data: {},
});
const lcpSpan = createSpan({
  op: 'largest-contentful-paint',
  data: {
    nodeId: 2,
  },
});
const navigateSpan = createSpan({
  op: 'navigation.navigate',
  description: 'http://test.com',
});
const cssSpan = createSpan({
  op: 'resource.css',
  description: 'http://test.com/static/media/glyphicons-halflings-regular.448c34a5.woff2',
});
const memorySpan = createSpan({
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
        startedAt: new Date(0),
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
          "timestamp": "1970-01-01T00:00:01.000Z",
          "type": "debug",
        },
      ]
    `);
  });

  it('adds navigation as a breadcrumb', () => {
    const rawSpans = [fooSpan, navigateSpan];

    const results = breadcrumbFactory(
      TestStubs.Event({
        startedAt: new Date(0),
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
          "timestamp": "1970-01-01T00:00:01.000Z",
          "type": "navigation",
        },
      ]
    `);
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
      startedAt: new Date(13),
      finishedAt: new Date(213),
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
      startedAt: new Date(startTimestampMs),
      finishedAt: new Date(endTimestampMs),
    } as ReplayRecord;

    expect(
      rrwebEventListFactory(replayRecord, [
        {type: 0, timestamp: 5_000, data: {}},
        {type: 1, timestamp: 1_000, data: {}},
        {type: 2, timestamp: 3_000, data: {}},
      ])
    ).toEqual([
      {type: 1, timestamp: 0, data: {}},
      {type: 2, timestamp: 3_000, data: {}},
      {type: 0, timestamp: 5_000, data: {}},
      {type: 5, timestamp: 10_000, data: {tag: 'replay-end'}},
    ]);
  });
});
