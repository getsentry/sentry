import type {AITraceSpanNode} from 'sentry/views/insights/pages/agents/utils/types';

import {getTimeBoundsFromNodes} from './timeBounds';

function makeNode(start: number, end: number): AITraceSpanNode {
  return {startTimestamp: start, endTimestamp: end} as unknown as AITraceSpanNode;
}

describe('getTimeBoundsFromNodes', () => {
  it('returns undefined for empty nodes', () => {
    expect(getTimeBoundsFromNodes([])).toEqual({
      startTimestamp: undefined,
      endTimestamp: undefined,
    });
  });

  it('returns bounds from a single node converted to ms', () => {
    expect(getTimeBoundsFromNodes([makeNode(100, 200)])).toEqual({
      startTimestamp: 100_000,
      endTimestamp: 200_000,
    });
  });

  it('returns min start and max end across multiple nodes', () => {
    const nodes = [makeNode(300, 400), makeNode(100, 500), makeNode(200, 350)];
    expect(getTimeBoundsFromNodes(nodes)).toEqual({
      startTimestamp: 100_000,
      endTimestamp: 500_000,
    });
  });
});
