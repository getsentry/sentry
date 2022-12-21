import {Rect} from 'sentry/utils/profiling/gl/utils';
import {SpanTree} from 'sentry/utils/profiling/spanTree';
import {makeFormatter} from 'sentry/utils/profiling/units/units';

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

  formatter = makeFormatter('milliseconds');
  configSpace: Rect = Rect.Empty();
  depth: number = 0;

  constructor(spanTree: SpanTree, _options: {configSpace?: Rect} = {}) {
    this.spanTree = spanTree;
    this.spans = this.collectSpanNodes();

    // @TODO once we start taking orphaned spans into account here we will need to
    // modify this to min(start_timestamp) max(end_timestamp)
    const minStart = Math.min(
      ...this.spanTree.root.children.map(node => node.span.start_timestamp)
    );
    const maxEnd = Math.max(
      ...this.spanTree.root.children.map(node => node.span.timestamp)
    );

    const duration = maxEnd - minStart;

    if (duration > 0) {
      this.configSpace = new Rect(0, 0, duration, this.depth);
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
    const minStart = Math.min(
      ...this.spanTree.root.children.map(node => node.span.start_timestamp)
    );
    const queue: SpanTree['root'][] = [...this.spanTree.root.children];
    let depth = 0;

    while (queue.length) {
      let children_at_depth = queue.length;
      while (children_at_depth-- !== 0) {
        const node = queue.shift()!;
        queue.push(...node.children);
        cb({
          duration: node.span.timestamp - node.span.start_timestamp,
          start: node.span.start_timestamp - minStart,
          end: node.span.timestamp,
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
