import {WeightedNode} from 'sentry/utils/profiling/weightedNode';

describe('weightedNode', () => {
  it('adds to total time', () => {
    const node = new WeightedNode();
    node.addToTotalWeight(100);
    node.addToTotalWeight(100);
    expect(node.totalWeight).toBe(200);
  });

  it('adds to self time', () => {
    const node = new WeightedNode();
    node.addToSelfWeight(100);
    node.addToSelfWeight(100);
    expect(node.selfWeight).toBe(200);
  });
});
