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

export class SpanTreeNode {
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
      this.span.start_timestamp <= span.start_timestamp &&
      this.span.timestamp >= span.timestamp
    );
  }
}

class SpanTree {
  root: SpanTreeNode;
  orphanedSpans: RawSpanType[] = [];

  constructor(transaction: EventTransaction, spans: RawSpanType[]) {
    this.root = SpanTreeNode.Root({
      description: transaction.title,
      start_timestamp: transaction.startTimestamp,
      timestamp: transaction.endTimestamp,
      exclusive_time: transaction.contexts?.trace?.exclusive_time ?? undefined,
      span_id: transaction.contexts?.trace?.span_id ?? undefined,
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

    for (let i = 0; i < spansSortedByStartTime.length; i++) {
      const span = spansSortedByStartTime[i];
      let parent = this.root;

      while (parent.contains(span)) {
        let nextParent: SpanTreeNode | null = null;
        for (let j = 0; j < parent.children.length; j++) {
          const child = parent.children[j];
          if (child.contains(span)) {
            nextParent = child;
            break;
          }
        }
        if (nextParent === null) {
          break;
        }
        parent = nextParent;
      }

      if (parent.span.span_id === span.parent_span_id) {
        parent.children.push(new SpanTreeNode(span, parent));
        continue;
      }

      this.orphanedSpans.push(span);
    }
  }
}

export {SpanTree};
