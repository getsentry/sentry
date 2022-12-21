import {Rect} from 'sentry/utils/profiling/gl/utils';
import {SpanTree} from 'sentry/utils/profiling/spanTree';
import {makeFormatter} from 'sentry/utils/profiling/units/units';

import {Profile} from './profile/profile';

function msToUnit(unit: Profile['unit']): (value: number) => number {
  let multiplier: number | null = null;

  switch (unit) {
    case 'milliseconds':
      multiplier = 1;
      break;
    case 'microseconds':
      multiplier = 1e3;
      break;
    case 'nanoseconds':
      multiplier = 1e6;
      break;
    default: {
      throw new Error(`Unknown unit : ${unit}`);
    }
  }

  if (multiplier === null) {
    throw new Error(`Unknown unit: ${unit} when converting span durations`);
  }
  return (value: number) => value * multiplier!;
}

export interface SpanChartNode {
  depth: number;
  duration: number;
  end: number;
  node: SpanTree['root'];
  start: number;
}

class SpanChart {
  spans: SpanChartNode[];
  spanTree: SpanTree;

  toFinalUnit = msToUnit('milliseconds');
  formatter = makeFormatter('milliseconds');
  configSpace: Rect = Rect.Empty();
  depth: number = 0;

  constructor(
    spanTree: SpanTree,
    options: {unit: Profile['unit']; configSpace?: Rect} = {unit: 'milliseconds'}
  ) {
    this.toFinalUnit = msToUnit(options.unit);
    this.spanTree = spanTree;
    this.spans = this.collectSpanNodes();

    const duration = spanTree.root.span.timestamp - spanTree.root.span.start_timestamp;

    if (duration > 0) {
      this.configSpace = new Rect(0, 0, this.toFinalUnit(duration), this.depth);
    } else {
      // If the span duration is 0, set the flamegraph duration to 1 second as flamechart
      this.configSpace = new Rect(
        0,
        0,
        1e3, // milliseconds
        0
      );
    }
  }

  // Bfs over the span tree while keeping track of level depth and calling the cb fn
  forEachSpan(cb: (node: SpanChartNode) => void) {
    const transactionStart = this.spanTree.root.span.start_timestamp;

    const queue: SpanTree['root'][] = [this.spanTree.root];
    let depth = 0;

    while (queue.length) {
      let children_at_depth = queue.length;

      while (children_at_depth-- !== 0) {
        const node = queue.shift()!;
        queue.push(...node.children);

        const duration = node.span.timestamp - node.span.start_timestamp;
        const start = node.span.start_timestamp - transactionStart;
        const end = start + duration;

        cb({
          duration: this.toFinalUnit(duration),
          start: this.toFinalUnit(start),
          end: this.toFinalUnit(end),
          node,
          depth,
        });
      }
      depth++;
    }
  }

  collectSpanNodes(): SpanChartNode[] {
    const nodes: SpanChartNode[] = [];

    const visit = (node: SpanChartNode): void => {
      this.depth = Math.max(this.depth, node.depth);
      nodes.push(node);
    };

    this.forEachSpan(visit);
    return nodes;
  }
}

export {SpanChart};
