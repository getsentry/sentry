import {uuid4} from '@sentry/core';

import type {RawSpanType} from 'sentry/components/events/interfaces/spans/types';
import {isEventFromBrowserJavaScriptSDK} from 'sentry/components/events/interfaces/spans/utils';
import {t} from 'sentry/locale';
import type {EventTransaction} from 'sentry/types/event';
import {EventOrGroupType} from 'sentry/types/event';

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

function sortByStartTimeAndDuration(a: SpanType, b: SpanType) {
  return a.start_timestamp - b.start_timestamp;
}

interface SpanType extends RawSpanType {
  event_id?: string;
}

export class SpanTreeNode {
  parent?: SpanTreeNode | null = null;
  span: SpanType;
  children: SpanTreeNode[] = [];

  constructor(span: SpanType, parent?: SpanTreeNode | null) {
    this.span = span;
    this.parent = parent;
  }

  static Root(partial: Partial<SpanType> = {}): SpanTreeNode {
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

  contains(span: SpanType) {
    return (
      this.span.start_timestamp <= span.start_timestamp &&
      this.span.timestamp >= span.timestamp
    );
  }
}

class SpanTree {
  root: SpanTreeNode;
  orphanedSpans: SpanType[] = [];
  transaction: EventTransaction;
  injectMissingInstrumentationSpans = true;

  constructor(transaction: EventTransaction, spans: SpanType[]) {
    this.transaction = transaction;
    this.injectMissingInstrumentationSpans =
      !isEventFromBrowserJavaScriptSDK(transaction);

    this.root = SpanTreeNode.Root({
      description: transaction.title,
      start_timestamp: transaction.startTimestamp,
      timestamp: transaction.endTimestamp,
      exclusive_time: transaction.contexts?.trace?.exclusive_time ?? undefined,
      span_id: transaction.contexts?.trace?.span_id ?? undefined,
      event_id: transaction.eventID,
      parent_span_id: undefined,
      trace_id: transaction.contexts?.trace?.trace_id ?? undefined,
      op: 'transaction',
    });

    this.buildCollapsedSpanTree(spans);
  }

  static Empty = new SpanTree(EmptyEventTransaction, []);

  isEmpty(): boolean {
    return this === SpanTree.Empty;
  }

  buildCollapsedSpanTree(spans: SpanType[]) {
    const spansSortedByStartTime = [...spans].sort(sortByStartTimeAndDuration);
    const MISSING_INSTRUMENTATION_THRESHOLD_S = 0.1;

    for (const span of spansSortedByStartTime) {
      let parent = this.root;

      while (parent.contains(span)) {
        let nextParent: SpanTreeNode | null = null;
        for (const child of parent.children) {
          if (child.span.op !== 'missing instrumentation' && child.contains(span)) {
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
        // If the missing instrumentation threshold is exceeded, add a span to
        // indicate that there is a gap in instrumentation. We can rely on this check
        // because the spans are sorted by start time, so we know that we will not be
        // updating anything before span.start_timestamp.
        if (
          this.injectMissingInstrumentationSpans &&
          parent.children.length > 0 &&
          span.start_timestamp -
            parent.children[parent.children.length - 1]!.span.timestamp >
            MISSING_INSTRUMENTATION_THRESHOLD_S
        ) {
          parent.children.push(
            new SpanTreeNode(
              {
                description: t('Missing span instrumentation'),
                op: 'missing span instrumentation',
                start_timestamp:
                  parent.children[parent.children.length - 1]!.span.timestamp,
                timestamp: span.start_timestamp,
                span_id: uuid4(),
                data: {},
                trace_id: span.trace_id,
              },
              parent
            )
          );
        }

        let foundOverlap = false;
        let start = parent.children.length - 1;
        while (start >= 0) {
          const child = parent.children[start]!;
          if (span.start_timestamp < child.span.timestamp) {
            foundOverlap = true;
            break;
          }
          start--;
        }
        if (foundOverlap) {
          this.orphanedSpans.push(span);
          continue;
        }
        // Insert child span
        parent.children.push(new SpanTreeNode(span, parent));
        continue;
      }

      this.orphanedSpans.push(span);
    }
  }
}

export {SpanTree};
