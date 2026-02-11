import type {BaseNode} from './baseNode';

export function traceChronologicalSort(a: BaseNode, b: BaseNode) {
  return a.space[0] - b.space[0];
}

// Returns a list of segments from a grouping sequence that can be used to render a span bar chart
// It looks for gaps between spans and creates a segment for each gap. If there are no gaps, it
// merges the n and n+1 segments.
export function computeCollapsedBarSpace(nodes: BaseNode[]): Array<[number, number]> {
  if (nodes.length === 0) {
    return [];
  }

  const first = nodes[0]!;

  const segments: Array<[number, number]> = [];

  let start = first.space[0];
  let end = first.space[0] + first.space[1];
  let i = 1;

  while (i < nodes.length) {
    const next = nodes[i]!;

    if (next.space[0] > end) {
      segments.push([start, end - start]);
      start = next.space[0];
      end = next.space[0] + next.space[1];
      i++;
    } else {
      end = next.space[0] + next.space[1];
      i++;
    }
  }

  segments.push([start, end - start]);

  return segments;
}
