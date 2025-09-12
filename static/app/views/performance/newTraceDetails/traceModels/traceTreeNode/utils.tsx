import type {BaseNode} from './baseNode';

export function traceChronologicalSort(a: BaseNode, b: BaseNode) {
  return a.space[0] - b.space[0];
}
