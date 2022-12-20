import {Rect} from 'sentry/utils/profiling/gl/utils';
import {SpanTree} from 'sentry/utils/profiling/spanTree';
import {makeFormatter} from 'sentry/utils/profiling/units/units';

export interface SpanChartNode {
  depth: number;
  end: number;
  node: SpanTree['spanTree'];
  start: number;
}

class SpanChart {
  spans: SpanChartNode[];
  spanTree: SpanTree;

  formatter = makeFormatter('milliseconds');
  configSpace: Rect = Rect.Empty();
  depth: number = 0;

  constructor(spanTree: SpanTree, {configSpace}: {configSpace?: Rect} = {}) {
    this.spanTree = spanTree;
    this.spans = this.collectSpanNodes();

    // @TODO once we start taking orphaned spans into account here we will need to
    // modify this to min(start_timestamp) max(end_timestamp)
    const duration =
      spanTree.spanTree.span.timestamp - spanTree.spanTree.span.start_timestamp;

    if (duration > 0) {
      this.configSpace = new Rect(
        configSpace ? configSpace.x : spanTree.spanTree.span.start_timestamp,
        0,
        configSpace ? configSpace.width : spanTree.spanTree.span.timestamp,
        this.depth
      );
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

  forEachSpan(cb: (node: SpanChartNode) => void) {
    const queue: SpanTree['spanTree'][] = [...this.spanTree.spanTree.children];
    let depth = 0;

    while (queue.length) {
      let children_at_depth = queue.length;
      while (children_at_depth-- !== 0) {
        const node = queue.pop()!;
        queue.push(...node.children);
        cb({start: node.span.start_timestamp, end: node.span.timestamp, node, depth});
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
