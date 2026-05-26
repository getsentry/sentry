import {SpanTree, SpanTreeNode} from 'sentry/utils/profiling/spanTree';
import {Rect} from 'sentry/utils/profiling/speedscope';
import {
  makeFormatter,
  makeFormatTo,
  makeTimelineFormatter,
} from 'sentry/utils/profiling/units/units';
import {SpanFields} from 'sentry/views/insights/types';

import type {Profile} from './profile/profile';

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
  depth = 0;
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

    if (tree.orphanedSpans.length > 0) {
      const orphanTree = new SpanTree(tree.transaction, []);
      const previousTreeNode = orphanTree.root;
      let previous: SpanChartNode | null = null;
      for (const span of tree.orphanedSpans) {
        const duration =
          span[SpanFields.PRECISE_FINISH_TS] - span[SpanFields.PRECISE_START_TS];
        const start =
          span[SpanFields.PRECISE_START_TS] - tree.root.span[SpanFields.PRECISE_START_TS];
        const end = start + duration;

        const spanFitsInPreviousRow =
          previous &&
          previous.node.span[SpanFields.PRECISE_FINISH_TS] <
            span[SpanFields.PRECISE_START_TS];

        const depth = spanFitsInPreviousRow
          ? this.depth
          : Math.max(this.depth, this.depth + 1);
        this.depth = depth;

        const op = span[SpanFields.SPAN_OP];
        const description = span[SpanFields.SPAN_DESCRIPTION];
        const spanChartNode: SpanChartNode = {
          duration: this.toFinalUnit(duration),
          start: this.toFinalUnit(start),
          end: this.toFinalUnit(end),
          text:
            op && description
              ? op + ': ' + description
              : op || description || '<unknown span>',
          node: new SpanTreeNode(span),
          depth,
          parent: this.root,
          children: [],
        };

        this.spans.push(spanChartNode);

        if (spanFitsInPreviousRow) {
          previous!.parent!.children.push(spanChartNode);
          previousTreeNode.children.push(
            new SpanTreeNode({
              ...span,
              [SpanFields.PRECISE_START_TS]:
                previous!.node.span[SpanFields.PRECISE_FINISH_TS],
              [SpanFields.PRECISE_FINISH_TS]:
                previous!.node.span[SpanFields.PRECISE_FINISH_TS] + duration,
            })
          );
        } else {
          this.root.children.push(spanChartNode);
          orphanTree.root.children.push(
            new SpanTreeNode({
              ...span,
              [SpanFields.PRECISE_START_TS]: tree.root.span[SpanFields.PRECISE_START_TS],
              [SpanFields.PRECISE_FINISH_TS]:
                tree.root.span[SpanFields.PRECISE_START_TS] + duration,
            })
          );
        }
        previous = spanChartNode;
      }
      this.spanTrees.push(orphanTree);
    }

    const duration = this.toFinalUnit(
      Math.max(...this.spanTrees.map(t => t.root.span[SpanFields.PRECISE_FINISH_TS])) -
        Math.min(...this.spanTrees.map(t => t.root.span[SpanFields.PRECISE_START_TS]))
    );

    this.configSpace =
      options.configSpace?.withHeight(this.depth) ?? new Rect(0, 0, duration, this.depth);
    this.root.end = duration;
    this.root.duration = duration;
  }

  // Bfs over the span tree while keeping track of level depth and calling the cb fn
  forEachSpanOfTree(
    tree: SpanTree,
    depthOffset: number,
    cb: (node: SpanChartNode) => void
  ): number {
    const transactionStart = tree.root.span[SpanFields.PRECISE_START_TS];

    // We only want to collect the root most node once
    const queue: Array<[SpanChartNode | null, SpanTreeNode]> =
      depthOffset === 0
        ? [[null, tree.root]]
        : tree.root.children.map(child => [null, child] as [null, SpanTreeNode]);

    let depth = 0;

    while (queue.length) {
      let children_at_depth = queue.length;

      while (children_at_depth-- !== 0) {
        const [parent, node] = queue.shift()!;

        const duration =
          node.span[SpanFields.PRECISE_FINISH_TS] -
          node.span[SpanFields.PRECISE_START_TS];
        const start = node.span[SpanFields.PRECISE_START_TS] - transactionStart;
        const end = start + duration;

        if (duration <= 0) {
          continue;
        }

        const op = node.span[SpanFields.SPAN_OP];
        const description = node.span[SpanFields.SPAN_DESCRIPTION];
        const spanChartNode: SpanChartNode = {
          duration: this.toFinalUnit(duration),
          start: this.toFinalUnit(start),
          end: this.toFinalUnit(end),
          text:
            op && description
              ? op + ': ' + description
              : op || description || '<unknown span>',
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

        for (const child of node.children) {
          queue.push([spanChartNode, child] as [SpanChartNode, SpanTreeNode]);
        }
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

    for (const tree of this.spanTrees) {
      depth += this.forEachSpanOfTree(tree, depth, visit);
    }

    return nodes;
  }
}

export {SpanChart};
