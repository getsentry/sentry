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
  text: string;
}

class SpanChart {
  spans: SpanChartNode[];
  root: SpanChartNode = {
    parent: null,
    node: SpanTreeNode.Root(),
    text: 'root',
    duration: 0,
    depth: -1,
    start: 0,
    end: 0,
    children: [],
  };
  spanTrees: SpanTree[];
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
    // Units need to be init before any profile iteration is done
    this.toFinalUnit = makeFormatTo('seconds', options.unit);
    this.timelineFormatter = makeTimelineFormatter(options.unit);
    this.formatter = makeFormatter(options.unit);

    this.spanTrees = [spanTree];

    let tree = spanTree;
    while (tree.orphanedSpans.length > 0) {
      const newTree = new SpanTree(tree.transaction, tree.orphanedSpans);
      // If a tree has same number of orhpaned spans as the previous tree, we are
      // stuck in an infinite loop, so break out and do nothing.
      if (newTree.orphanedSpans.length === tree.orphanedSpans.length) {
        break;
      }
      this.spanTrees.push(newTree);
      tree = newTree;
    }

    this.spans = this.collectSpanNodes();

    const duration = this.toFinalUnit(
      Math.max(...this.spanTrees.map(t => t.root.span.timestamp)) -
        Math.min(...this.spanTrees.map(t => t.root.span.start_timestamp))
    );

    this.configSpace = new Rect(0, 0, duration, this.depth);
    this.root.end = duration;
    this.root.duration = duration;
  }

  // Bfs over the span tree while keeping track of level depth and calling the cb fn
  forEachSpanOfTree(
    tree: SpanTree,
    depthOffset: number,
    cb: (node: SpanChartNode) => void
  ): number {
    const transactionStart = tree.root.span.start_timestamp;

    // We only want to collect the root most node once
    const queue: [SpanChartNode | null, SpanTreeNode][] =
      depthOffset === 0
        ? [[null, tree.root]]
        : [...tree.root.children.map(child => [null, child] as [null, SpanTreeNode])];

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
          text:
            node.span.op && node.span.description
              ? node.span.op + ': ' + node.span.description
              : node.span.op || node.span.description || '<unknown span>',
          node,
          depth: depth + depthOffset,
          parent,
          children: [],
        };

        cb(spanChartNode);

        if (parent) {
          parent.children.push(spanChartNode);
        } else {
          this.root.children.push(spanChartNode);
        }

        queue.push(
          ...node.children.map(
            // @todo use satisfies here when available
            child => [spanChartNode, child] as [SpanChartNode, SpanTreeNode]
          )
        );
      }
      depth++;
    }

    return depth;
  }

  collectSpanNodes(): SpanChartNode[] {
    const nodes: SpanChartNode[] = [];

    let depth = 0;
    const visit = (node: SpanChartNode): void => {
      this.depth = Math.max(this.depth, node.depth);
      this.minSpanDuration = Math.min(this.minSpanDuration, node.duration);
      nodes.push(node);
    };

    for (let i = 0; i < this.spanTrees.length; i++) {
      depth += this.forEachSpanOfTree(this.spanTrees[i], depth, visit);
    }

    return nodes;
  }
}

export {SpanChart};
