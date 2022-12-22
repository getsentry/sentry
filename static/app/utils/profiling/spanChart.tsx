import {Rect} from 'sentry/utils/profiling/gl/utils';
import {SpanTree} from 'sentry/utils/profiling/spanTree';
import {makeFormatter, makeFormatTo} from 'sentry/utils/profiling/units/units';

import {Profile} from './profile/profile';

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
  depth: number = 0;

  toFinalUnit = makeFormatTo('milliseconds', 'milliseconds');
  formatter = makeFormatter('milliseconds');

  constructor(
    spanTree: SpanTree,
    options: {unit: Profile['unit']; configSpace?: Rect} = {unit: 'milliseconds'}
  ) {
    this.spanTree = spanTree;
    this.toFinalUnit = makeFormatTo('milliseconds', options.unit);
    this.spans = this.collectSpanNodes();
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
