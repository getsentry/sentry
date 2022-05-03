import createHighlightEvents from 'sentry/views/replays/utils/createHighlightEvents';

it('returns a list of replay events for highlights', function () {
  const events = [
    {
      op: 'foo',
      data: {},
      start_timestamp: 1,
    },
    {
      op: 'largest-contentful-paint',
      data: {
        nodeId: 2,
      },
      start_timestamp: 1,
    },
    {
      op: 'largest-contentful-paint',
      data: {
        nodeId: null,
      },
      start_timestamp: 1,
    },
    {
      op: 'largest-contentful-paint',
      data: {
        nodeId: -0,
      },
      start_timestamp: 1,
    },
    {
      op: 'largest-contentful-paint',
      data: {
        nodeId: -1,
      },
      start_timestamp: 1,
    },
    {
      op: 'largest-contentful-paint',
      data: {
        nodeId: 10,
      },
      start_timestamp: 1,
    },
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
