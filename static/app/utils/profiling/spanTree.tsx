import {uuid4} from '@sentry/core';

import {isBrowserJavaScriptSDKName} from 'sentry/components/events/interfaces/spans/utils';
import {t} from 'sentry/locale';
import type {SpanResponse} from 'sentry/views/insights/types';
import {SpanFields} from 'sentry/views/insights/types';

export type TransactionSpanData = Pick<
  SpanResponse,
  | 'span.description'
  | 'precise.start_ts'
  | 'precise.finish_ts'
  | 'span_id'
  | 'span.self_time'
  | 'trace'
  | 'sdk.name'
  | 'transaction.event_id'
>;

export type SpanNodeData = Pick<
  SpanResponse,
  | 'span.description'
  | 'span.op'
  | 'precise.start_ts'
  | 'precise.finish_ts'
  | 'span_id'
  | 'trace'
  | 'trace.parent_span'
  | 'trace.status'
  | 'transaction.event_id'
>;

// Empty transaction to use as a default value with duration of 1 second.
// Timestamps are in seconds to match precise.*_ts semantics downstream.
const EmptyTransactionSpan: TransactionSpanData = {
  [SpanFields.SPAN_DESCRIPTION]: '',
  [SpanFields.PRECISE_START_TS]: 0,
  [SpanFields.PRECISE_FINISH_TS]: 1,
  [SpanFields.SPAN_ID]: '',
  [SpanFields.SPAN_SELF_TIME]: 0,
  [SpanFields.TRACE]: '',
  [SpanFields.SDK_NAME]: '',
  [SpanFields.TRANSACTION_EVENT_ID]: '',
};

function sortByStartTimeAndDuration(a: SpanNodeData, b: SpanNodeData) {
  return a[SpanFields.PRECISE_START_TS] - b[SpanFields.PRECISE_START_TS];
}

export class SpanTreeNode {
  parent?: SpanTreeNode | null = null;
  span: SpanNodeData;
  children: SpanTreeNode[] = [];

  constructor(span: SpanNodeData, parent?: SpanTreeNode | null) {
    this.span = span;
    this.parent = parent;
  }

  static Root(partial: Partial<SpanNodeData> = {}): SpanTreeNode {
    return new SpanTreeNode(
      {
        [SpanFields.SPAN_DESCRIPTION]: 'root',
        [SpanFields.SPAN_OP]: 'root',
        [SpanFields.PRECISE_START_TS]: 0,
        [SpanFields.PRECISE_FINISH_TS]: Number.MAX_SAFE_INTEGER,
        [SpanFields.TRACE_PARENT_SPAN]: '',
        [SpanFields.SPAN_ID]: '<root>',
        [SpanFields.TRACE]: '',
        [SpanFields.TRACE_STATUS]: '',
        [SpanFields.TRANSACTION_EVENT_ID]: '',
        ...partial,
      },
      null
    );
  }

  contains(span: SpanNodeData) {
    return (
      this.span[SpanFields.PRECISE_START_TS] <= span[SpanFields.PRECISE_START_TS] &&
      this.span[SpanFields.PRECISE_FINISH_TS] >= span[SpanFields.PRECISE_FINISH_TS]
    );
  }
}

class SpanTree {
  root: SpanTreeNode;
  orphanedSpans: SpanNodeData[] = [];
  transaction: TransactionSpanData;
  injectMissingInstrumentationSpans = true;

  constructor(transaction: TransactionSpanData, spans: SpanNodeData[]) {
    this.transaction = transaction;
    this.injectMissingInstrumentationSpans = !isBrowserJavaScriptSDKName(
      transaction[SpanFields.SDK_NAME]
    );

    this.root = SpanTreeNode.Root({
      [SpanFields.SPAN_DESCRIPTION]: transaction[SpanFields.SPAN_DESCRIPTION],
      [SpanFields.PRECISE_START_TS]: transaction[SpanFields.PRECISE_START_TS],
      [SpanFields.PRECISE_FINISH_TS]: transaction[SpanFields.PRECISE_FINISH_TS],
      [SpanFields.SPAN_ID]: transaction[SpanFields.SPAN_ID],
      [SpanFields.TRANSACTION_EVENT_ID]: transaction[SpanFields.TRANSACTION_EVENT_ID],
      [SpanFields.TRACE]: transaction[SpanFields.TRACE],
      [SpanFields.SPAN_OP]: 'transaction',
    });

    this.buildCollapsedSpanTree(spans);
  }

  static Empty = new SpanTree(EmptyTransactionSpan, []);

  isEmpty(): boolean {
    return this === SpanTree.Empty;
  }

  buildCollapsedSpanTree(spans: SpanNodeData[]) {
    const spansSortedByStartTime = [...spans].sort(sortByStartTimeAndDuration);
    const MISSING_INSTRUMENTATION_THRESHOLD_S = 0.1;

    for (const span of spansSortedByStartTime) {
      let parent = this.root;

      while (parent.contains(span)) {
        let nextParent: SpanTreeNode | null = null;
        for (const child of parent.children) {
          if (
            child.span[SpanFields.SPAN_OP] !== 'missing instrumentation' &&
            child.contains(span)
          ) {
            nextParent = child;
            break;
          }
        }
        if (nextParent === null) {
          break;
        }
        parent = nextParent;
      }

      if (parent.span[SpanFields.SPAN_ID] === span[SpanFields.TRACE_PARENT_SPAN]) {
        // If the missing instrumentation threshold is exceeded, add a span to
        // indicate that there is a gap in instrumentation. We can rely on this check
        // because the spans are sorted by start time, so we know that we will not be
        // updating anything before span start timestamp.
        if (
          this.injectMissingInstrumentationSpans &&
          parent.children.length > 0 &&
          span[SpanFields.PRECISE_START_TS] -
            parent.children[parent.children.length - 1]!.span[
              SpanFields.PRECISE_FINISH_TS
            ] >
            MISSING_INSTRUMENTATION_THRESHOLD_S
        ) {
          parent.children.push(
            new SpanTreeNode(
              {
                [SpanFields.SPAN_DESCRIPTION]: t('Missing span instrumentation'),
                [SpanFields.SPAN_OP]: 'missing span instrumentation',
                [SpanFields.PRECISE_START_TS]:
                  parent.children[parent.children.length - 1]!.span[
                    SpanFields.PRECISE_FINISH_TS
                  ],
                [SpanFields.PRECISE_FINISH_TS]: span[SpanFields.PRECISE_START_TS],
                [SpanFields.SPAN_ID]: uuid4(),
                [SpanFields.TRACE]: span[SpanFields.TRACE],
                [SpanFields.TRACE_PARENT_SPAN]: '',
                [SpanFields.TRACE_STATUS]: '',
                [SpanFields.TRANSACTION_EVENT_ID]: '',
              },
              parent
            )
          );
        }

        let foundOverlap = false;
        let start = parent.children.length - 1;
        while (start >= 0) {
          const child = parent.children[start]!;
          if (
            span[SpanFields.PRECISE_START_TS] < child.span[SpanFields.PRECISE_FINISH_TS]
          ) {
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
