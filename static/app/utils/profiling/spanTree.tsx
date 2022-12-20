import {RawSpanType} from 'sentry/components/events/interfaces/spans/types';

class SpanTreeNode {
  parent?: SpanTreeNode | null = null;
  span: RawSpanType;
  children: SpanTreeNode[] = [];

  constructor(span: RawSpanType, parent?: SpanTreeNode | null) {
    this.span = span;
    this.parent = parent;
  }

  static Root() {
    return new SpanTreeNode(
      {
        description: 'root',
        op: 'root',
        start_timestamp: 0,
        exclusive_time: 0,
        timestamp: Number.MAX_SAFE_INTEGER,
        parent_span_id: '',
        data: {},
        span_id: '',
        trace_id: '',
        hash: '',
      },
      null
    );
  }

  contains(span: RawSpanType) {
    return (
      span.start_timestamp >= this.span.start_timestamp &&
      span.timestamp <= this.span.timestamp
    );
  }
}

class SpanTree {
  spanTree: SpanTreeNode = SpanTreeNode.Root();
  orphanedSpans: RawSpanType[] = [];

  constructor(spans: RawSpanType[]) {
    this.buildCollapsedSpanTree(spans);
  }

  static Empty(): SpanTree {
    return new SpanTree([]);
  }

  buildCollapsedSpanTree(spans: RawSpanType[]) {
    const spansSortedByStartTime = [...spans].sort((a, b) => {
      if (a.start_timestamp < b.start_timestamp) {
        return -1;
      }
      // if the start times are the same, we want to sort by end time
      if (a.start_timestamp === b.start_timestamp) {
        if (a.timestamp < b.timestamp) {
          return 1; // a is a child of b
        }
        return -1; // b is a child of a
      }
      return 1;
    });

    for (const span of spansSortedByStartTime) {
      const queue = [...this.spanTree.children];
      let parent: SpanTreeNode | null = null;

      // If this is the first span, just push it to the root
      if (!this.spanTree.children.length) {
        this.spanTree.children.push(new SpanTreeNode(span, this.spanTree));
        continue;
      }

      while (queue.length > 0) {
        const current = queue.pop()!;
        if (current.contains(span)) {
          parent = current;
          queue.push(...current.children);
        }
      }

      // if we didn't find a parent, we have an orphaned span
      if (parent === null) {
        this.orphanedSpans.push(span);
        continue;
      }
      parent.children.push(new SpanTreeNode(span, parent));
    }
  }
}

export {SpanTree};
