import {
  breadcrumbFactory,
  // breadcrumbValuesFromEvents,
  rrwebEventListFactory,
  // spanDataFromEvents,
  // spanEntryFactory,
} from 'sentry/utils/replays/replayDataUtils';
import type {ReplayRecord} from 'sentry/views/replays/types';

describe('breadcrumbFactory', () => {
  function createSpan(extra: {
    op: string;
    data?: Record<string, any>;
    description?: string;
  }) {
    return {
      startTimestamp: 1,
      endTimestamp: 2,
      data: {},
      ...extra,
    };
  }
  it('adds LCP as a breadcrumb', () => {
    const rawSpans = [
      createSpan({
        op: 'foo',
        data: {},
      }),
      createSpan({
        op: 'largest-contentful-paint',
        data: {
          nodeId: 2,
        },
      }),
    ];

    const results = breadcrumbFactory(
      TestStubs.Event({
        startedAt: new Date(0),
      }),
      [],
      [],
      rawSpans
    );

    expect(results).toMatchInlineSnapshot(`
      Array [
        Object {
          "color": "gray300",
          "data": Object {
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
        Object {
          "category": "default",
          "color": "purple300",
          "data": Object {
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
    const rawSpans = [
      createSpan({
        op: 'foo',
        data: {},
      }),
      createSpan({
        op: 'navigation.navigate',
        description: 'http://test.com',
      }),
    ];

    const results = breadcrumbFactory(
      TestStubs.Event({
        startedAt: new Date(0),
      }),
      [],
      [],
      rawSpans
    );

    expect(results).toMatchInlineSnapshot(`
      Array [
        Object {
          "action": "navigate",
          "category": "default",
          "color": "green300",
          "data": Object {
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

describe('rrwebEventListFactory', () => {
  it('returns a list of replay events for highlights', function () {
    const replayRecord = {
      startedAt: new Date(13),
      finishedAt: new Date(213),
    } as ReplayRecord;

    const results = rrwebEventListFactory(replayRecord, []);

    expect(results).toMatchInlineSnapshot(`
      Array [
        Object {
          "data": Object {
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
