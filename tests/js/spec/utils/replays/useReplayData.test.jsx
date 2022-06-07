const {mapRRWebAttachments} = require('sentry/utils/replays/hooks/useReplayData');

const testPayload = [
  {
    type: 3,
    data: {
      source: 1,
      positions: [
        {x: 737, y: 553, id: 46, timeOffset: -446},
        {x: 655, y: 614, id: 52, timeOffset: -385},
        {x: 653, y: 614, id: 52, timeOffset: -285},
        {x: 653, y: 613, id: 52, timeOffset: -226},
        {x: 653, y: 613, id: 52, timeOffset: -171},
        {x: 662, y: 601, id: 50, timeOffset: -105},
        {x: 671, y: 591, id: 50, timeOffset: -46},
      ],
    },
    timestamp: 1654290037123,
  },
  {
    type: 3,
    data: {
      source: 0,
      texts: [],
      attributes: [],
      removes: [],
      adds: [
        {
          parentId: 33,
          nextId: null,
          node: {
            type: 2,
            tagName: 'com-1password-button',
            attributes: {},
            childNodes: [],
            id: 65,
          },
        },
      ],
    },
    timestamp: 1654290037561,
  },
  {
    type: 5,
    timestamp: 1654290037.267,
    data: {
      tag: 'breadcrumb',
      payload: {
        timestamp: 1654290037.267,
        type: 'default',
        category: 'ui.click',
        message: 'body > div#root > div.App > form',
        data: {nodeId: 44},
      },
    },
  },
  {
    type: 5,
    timestamp: 1654290034.2623,
    data: {
      tag: 'performanceSpan',
      payload: {
        op: 'navigation.navigate',
        description: 'http://localhost:3000/',
        startTimestamp: 1654290034.2623,
        endTimestamp: 1654290034.5808,
        data: {size: 1150},
      },
    },
  },
  {
    type: 5,
    timestamp: 1654290034.2623,
    data: {
      tag: 'performanceSpan',
      payload: {
        op: 'navigation.navigate',
        description: 'http://localhost:3000/',
        startTimestamp: 1654290034.2623,
        endTimestamp: 1654290034.5808,
        data: {size: 1150},
      },
    },
  },
];

describe('useReplayData Hooks', () => {
  it('t', () => {
    const results = mapRRWebAttachments(testPayload);
    expect(results.breadcrumbs.length).toBe(1);
    expect(results.recording.length).toBe(2);
    expect(results.replaySpans.length).toBe(2);
  });
});
