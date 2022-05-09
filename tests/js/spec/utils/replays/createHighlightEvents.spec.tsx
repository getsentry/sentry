import createHighlightEvents from 'sentry/utils/replays/createHighlightEvents';

function createSpan(extra: Record<string, any>) {
  return {
    span_id: 'spanid',
    start_timestamp: 1,
    timestamp: 2,
    trace_id: 'traceid',
    data: {},
    ...extra,
  };
}

it('returns a list of replay events for highlights', function () {
  const events = [
    createSpan({
      op: 'foo',
    }),
    createSpan({
      op: 'largest-contentful-paint',
      data: {
        nodeId: 2,
      },
    }),
    createSpan({
      op: 'largest-contentful-paint',
      data: {
        nodeId: null,
      },
    }),
    createSpan({
      op: 'largest-contentful-paint',
      data: {
        nodeId: 0,
      },
    }),
    createSpan({
      op: 'largest-contentful-paint',
      data: {
        nodeId: -1,
      },
    }),
    createSpan({
      op: 'largest-contentful-paint',
      data: {
        nodeId: 10,
      },
    }),
  ];

  const results = createHighlightEvents(events);

  expect(results).toMatchInlineSnapshot(`
    Array [
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
