import * as Sentry from '@sentry/react';
import keyBy from 'lodash/keyBy';

import type {EntrySpans, EventTransaction} from 'sentry/types/event';
import {EntryType} from 'sentry/types/event';
import {
  getIssueTypeFromOccurrenceType,
  IssueCategory,
  IssueType,
} from 'sentry/types/group';

import type {RawSpanType} from '../spans/types';

import type {TraceContextSpanProxy} from './spanEvidence';

export function getSpanInfoFromTransactionEvent(
  event: Pick<
    EventTransaction,
    | 'entries'
    | 'perfProblem'
    | 'issueCategory'
    | 'endTimestamp'
    | 'contexts'
    | 'occurrence'
  >
) {
  const perfEvidenceData = event.perfProblem ?? event?.occurrence?.evidenceData;
  if (!perfEvidenceData) {
    if (
      event.issueCategory === IssueCategory.PERFORMANCE &&
      event.endTimestamp > 1663560000 //  (Sep 19, 2022 onward), Some events could have been missing evidence before EA
    ) {
      Sentry.captureException(new Error('Span Evidence missing for performance issue.'));
    }
    return null;
  }

  // Let's dive into the event to pick off the span evidence data by using the IDs we know
  const spanEntry = event.entries.find((entry: EntrySpans | any): entry is EntrySpans => {
    return entry.type === EntryType.SPANS;
  });

  const spans: (RawSpanType | TraceContextSpanProxy)[] = spanEntry?.data
    ? [...spanEntry.data]
    : [];

  if (event?.contexts?.trace?.span_id) {
    // TODO: Fix this conditional and check if span_id is ever actually undefined.
    spans.push(event.contexts.trace as TraceContextSpanProxy);
  }
  const spansById = keyBy(spans, 'span_id');
  const parentSpanIDs = perfEvidenceData?.parentSpanIds ?? [];
  const offendingSpanIDs = perfEvidenceData?.offenderSpanIds ?? [];
  const causeSpanIDs = perfEvidenceData?.causeSpanIds ?? [];
  return {
    parentSpan: spansById[parentSpanIDs[0]],
    offendingSpans: offendingSpanIDs.map((spanID: any) => spansById[spanID]),
    causeSpans: causeSpanIDs.map((spanID: any) => spansById[spanID]),
  };
}

/**
 * Given an event for a performance issue, returns the `affectedSpanIds` and `focusedSpanIds`.
 * Both of these subsets of spans are used to determine which spans are initially visible on the span tree on the issue details
 * page. The main difference is that the former will be highlighted in red, these spans are intended to indicate the 'root cause' spans
 * of the issue, with the latter being supplemental spans that are involved in the issue but not necessarily the cause of it.
 *
 * @param event
 */
export function getProblemSpansForSpanTree(event: EventTransaction): {
  affectedSpanIds: string[];
  focusedSpanIds: string[];
} {
  const perfEvidenceData = event.perfProblem ?? event?.occurrence?.evidenceData;

  const issueType =
    event.perfProblem?.issueType ??
    getIssueTypeFromOccurrenceType(event?.occurrence?.type);
  const affectedSpanIds: string[] = [];
  const focusedSpanIds: string[] = [];

  // By default, offender spans will always be `affected spans`
  const offenderSpanIds = perfEvidenceData?.offenderSpanIds ?? [];
  affectedSpanIds.push(...offenderSpanIds);

  if (issueType !== IssueType.PERFORMANCE_N_PLUS_ONE_API_CALLS) {
    const parentSpanIds = perfEvidenceData?.parentSpanIds ?? [];
    affectedSpanIds.push(...parentSpanIds);
  }

  if (issueType === IssueType.PERFORMANCE_CONSECUTIVE_DB_QUERIES) {
    const consecutiveSpanIds = perfEvidenceData?.causeSpanIds ?? [];

    if (consecutiveSpanIds.length < 11) {
      focusedSpanIds.push(...consecutiveSpanIds);
    }
  }

  if (issueType === IssueType.PERFORMANCE_N_PLUS_ONE_DB_QUERIES) {
    const precedingSpans = perfEvidenceData?.causeSpanIds ?? [];
    focusedSpanIds.push(...precedingSpans);
  }

  return {affectedSpanIds, focusedSpanIds};
}
