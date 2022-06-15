import {
  // breadcrumbEntryFactory,
  // breadcrumbValuesFromEvents,
  // replayTimestamps,
  rrwebEventListFactory,
  // spanDataFromEvents,
  // spanEntryFactory,
} from 'sentry/utils/replays/replayDataUtils';

describe('rrwebEventListFactory', () => {
  // function createSpan(extra: {op: string; data?: Record<string, any>}) {
  // return {
  // // span_id: 'spanid',
  // startTimestamp: 1,
  // endTimestamp: 2,
  // // trace_id: 'traceid',
  // data: {},
  // ...extra,
  // };
  // }

  it('returns a list of replay events for highlights', function () {
    // const rawSpans = [
    // createSpan({
    // op: 'foo',
    // data: {},
    // }),
    // createSpan({
    // op: 'largest-contentful-paint',
    // data: {
    // nodeId: 2,
    // },
    // }),
    // createSpan({
    // op: 'largest-contentful-paint',
    // data: {
    // nodeId: null,
    // },
    // }),
    // createSpan({
    // op: 'largest-contentful-paint',
    // data: {
    // nodeId: 0,
    // },
    // }),
    // createSpan({
    // op: 'largest-contentful-paint',
    // data: {
    // nodeId: -1,
    // },
    // }),
    // createSpan({
    // op: 'largest-contentful-paint',
    // data: {
    // nodeId: 10,
    // },
    // }),
    // ];

    const results = rrwebEventListFactory(0, 0, []);

    expect(results).toMatchInlineSnapshot(`
      Array [
        Object {
          "data": Object {
            "tag": "replay-end",
          },
          "timestamp": 0,
          "type": 5,
        },
        Object {
          "data": Object {
            "nodeId": 2,
            "text": "LCP",
          },
          "timestamp": 1000,
          "type": 6,
        },
        Object {
          "data": Object {
            "nodeId": 10,
            "text": "LCP",
          },
          "timestamp": 1000,
          "type": 6,
        },
      ]
    `);
  });

  it('merges and sorts rrweb-events and span data', function () {
    const startTimestampMS = 0;
    const endTimestampMS = 10_000;

    expect(
      rrwebEventListFactory(
        startTimestampMS,
        endTimestampMS,
        // [
        // createSpan({
        // op: 'largest-contentful-paint',
        // data: {
        // nodeId: 2,
        // },
        // }),
        // ],
        [
          {type: 0, timestamp: 5_000, data: {}},
          {type: 1, timestamp: 1_000, data: {}},
          {type: 2, timestamp: 3_000, data: {}},
        ]
      )
    ).toEqual([
      {type: 1, timestamp: 0, data: {}},
      {type: 6, timestamp: 1_000, data: {nodeId: 2, text: 'LCP'}},
      {type: 2, timestamp: 3_000, data: {}},
      {type: 0, timestamp: 5_000, data: {}},
      {type: 5, timestamp: 10_000, data: {tag: 'replay-end'}},
    ]);
  });
});
