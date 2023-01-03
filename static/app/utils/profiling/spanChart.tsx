import {Rect} from 'sentry/utils/profiling/gl/utils';
import {SpanTree, SpanTreeNode} from 'sentry/utils/profiling/spanTree';
import {
  makeFormatter,
  makeFormatTo,
  makeTimelineFormatter,
} from 'sentry/utils/profiling/units/units';

import {Profile} from './profile/profile';

export interface SpanChartNode {
  children: SpanChartNode[];
  depth: number;
  duration: number;
  end: number;
  node: SpanTree['root'];
  parent: SpanChartNode | null;
  start: number;
}

class SpanChart {
  spans: SpanChartNode[];
  root: SpanChartNode = {
    parent: null,
    node: SpanTreeNode.Root(),
    duration: 0,
    depth: -1,
    start: 0,
    end: 0,
    children: [],
  };
  spanTree: SpanTree;
  depth: number = 0;
  minSpanDuration: number = Number.POSITIVE_INFINITY;
  configSpace: Rect;

  toFinalUnit = makeFormatTo('milliseconds', 'milliseconds');
  formatter = makeFormatter('milliseconds');
  timelineFormatter: (value: number) => string;

  constructor(
    spanTree: SpanTree,
    options: {unit: Profile['unit']; configSpace?: Rect} = {unit: 'milliseconds'}
  ) {
    this.spanTree = spanTree;
    this.toFinalUnit = makeFormatTo('seconds', options.unit);
    this.spans = this.collectSpanNodes();
    this.timelineFormatter = makeTimelineFormatter(options.unit);

    const duration = this.toFinalUnit(
      this.spanTree.root.span.timestamp - this.spanTree.root.span.start_timestamp
    );

    this.configSpace = new Rect(0, 0, duration, this.depth);
  }

  // Bfs over the span tree while keeping track of level depth and calling the cb fn
  forEachSpan(cb: (node: SpanChartNode) => void) {
    const transactionStart = this.spanTree.root.span.start_timestamp;
    const queue: [SpanChartNode | null, SpanTreeNode][] = [[null, this.spanTree.root]];
    let depth = 0;

    while (queue.length) {
      let children_at_depth = queue.length;

      while (children_at_depth-- !== 0) {
        const [parent, node] = queue.shift()!;

        const duration = node.span.timestamp - node.span.start_timestamp;
        const start = node.span.start_timestamp - transactionStart;
        const end = start + duration;

        const spanChartNode: SpanChartNode = {
          duration: this.toFinalUnit(duration),
          start: this.toFinalUnit(start),
          end: this.toFinalUnit(end),
          node,
          depth,
          parent,
          children: [],
        };

        cb(spanChartNode);

        if (parent) {
          parent.children.push(spanChartNode);
        } else {
          this.root.children.push(spanChartNode);
        }

        const nodesWithParent = node.children.map(
          // @todo use satisfies here when available
          child => [spanChartNode, child] as [SpanChartNode, SpanTreeNode]
        );
        queue.push(...nodesWithParent);
      }
      depth++;
    }
  }

  collectSpanNodes(): SpanChartNode[] {
    const nodes: SpanChartNode[] = [];

    const visit = (node: SpanChartNode): void => {
      this.depth = Math.max(this.depth, node.depth);
      this.minSpanDuration = Math.min(this.minSpanDuration, node.duration);
      nodes.push(node);
    };

    this.forEachSpan(visit);
    return nodes;
  }
}

export {SpanChart};
