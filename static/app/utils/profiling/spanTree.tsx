import {RawSpanType} from 'sentry/components/events/interfaces/spans/types';
import {EventOrGroupType, EventTransaction} from 'sentry/types';

// Empty transaction to use as a default value with duration of 1 second
const EmptyEventTransaction: EventTransaction = {
  id: '',
  projectID: '',
  user: {},
  contexts: {},
  entries: [],
  errors: [],
  dateCreated: '',
  startTimestamp: Date.now(),
  endTimestamp: Date.now() + 1000,
  title: '',
  type: EventOrGroupType.TRANSACTION,
  culprit: '',
  dist: null,
  eventID: '',
  fingerprints: [],
  dateReceived: new Date().toISOString(),
  message: '',
  metadata: {},
  size: 0,
  tags: [],
  occurrence: null,
  location: '',
  crashFile: null,
};

function sortByStartTimeAndDuration(a: RawSpanType, b: RawSpanType) {
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
}
class SpanTreeNode {
  parent?: SpanTreeNode | null = null;
  span: RawSpanType;
  children: SpanTreeNode[] = [];

  constructor(span: RawSpanType, parent?: SpanTreeNode | null) {
    this.span = span;
    this.parent = parent;
  }

  static Root(partial: Partial<RawSpanType> = {}): SpanTreeNode {
    return new SpanTreeNode(
      {
        description: 'root',
        op: 'root',
        start_timestamp: 0,
        exclusive_time: 0,
        timestamp: Number.MAX_SAFE_INTEGER,
        parent_span_id: '',
        data: {},
        span_id: '<root>',
        trace_id: '',
        hash: '',
        ...partial,
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
  root: SpanTreeNode;
  transaction: EventTransaction;
  orphanedSpans: RawSpanType[] = [];

  constructor(transaction: EventTransaction, spans: RawSpanType[]) {
    this.transaction = transaction;
    this.root = SpanTreeNode.Root({
      description: transaction.title,
      start_timestamp: transaction.startTimestamp,
      timestamp: transaction.endTimestamp,
      exclusive_time: transaction.endTimestamp - transaction.startTimestamp,
      parent_span_id: undefined,
      op: 'transaction',
    });
    this.buildCollapsedSpanTree(spans);
  }

  static Empty(): SpanTree {
    return new SpanTree(EmptyEventTransaction, []);
  }

  buildCollapsedSpanTree(spans: RawSpanType[]) {
    const spansSortedByStartTime = [...spans].sort(sortByStartTimeAndDuration);

    for (const span of spansSortedByStartTime) {
      const queue = [...this.root.children];
      let parent: SpanTreeNode | null = null;

      // If this is the first span, just push it to the root
      if (!this.root.children.length) {
        this.root.children.push(new SpanTreeNode(span, this.root));
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
