import type {BaseNode} from './baseNode';
import {isZeroDurationNode} from './utils';

function nodeWithSpace(space: [number, number]) {
  return {space} as BaseNode;
}

describe('isZeroDurationNode', () => {
  it('identifies nodes with zero duration', () => {
    expect(isZeroDurationNode(nodeWithSpace([100, 0]))).toBe(true);
  });

  it('does not identify positive or negative durations as zero duration', () => {
    expect(isZeroDurationNode(nodeWithSpace([100, 1]))).toBe(false);
    expect(isZeroDurationNode(nodeWithSpace([100, -1]))).toBe(false);
  });
});
