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

  formatter: (value: number) => string;
  configSpace: Rect = Rect.Empty();
  depth: number = 0;

  constructor(spanTree: SpanTree) {
    this.spanTree = spanTree;
    this.formatter = makeFormatter('miliseconds');
    this.spans = this.collectSpanNodes();

    // if (this.profile.duration > 0) {
    //   this.configSpace = new Rect(
    //     configSpace ? configSpace.x : this.profile.startedAt,
    //     0,
    //     configSpace ? configSpace.width : this.profile.duration,
    //     this.depth
    //   );
    // } else {
    //   // If the profile duration is 0, set the flamegraph duration
    //   // to 1 second so we can render a placeholder grid
    //   this.configSpace = new Rect(
    //     0,
    //     0,
    //     1e3, // milliseconds
    //     0
    //   );
    // }
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
