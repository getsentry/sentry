import type {Annotation} from 'sentry/utils/timeSeries/useFetchEventsTimeSeries';

import {outcomeLabel} from './droppedDataChart';

export interface ReasonRow {
  droppedBuckets: number;
  events: number;
  lastSeen: number;
  outcome: string;
  reason: string;
  shareRatio: number;
}

export interface CategorySection {
  events: number;
  label: string;
  outcome: string;
  reasons: ReasonRow[];
  shareRatio: number;
}

interface ReasonAggregate {
  buckets: Set<number>;
  events: number;
  lastSeen: number;
}

/**
 * Group dropped annotations into one collapsible section per outcome, each with
 * a row per reason. Shares are computed against total events (accepted +
 * dropped); a reason's `droppedBuckets` counts the distinct time buckets it
 * appears in, out of `totalBuckets`.
 *
 * Single pass over the annotations builds the (outcome, reason) aggregates and
 * running totals; the section list is then assembled from them.
 *
 * `now` (defaulting to the current time) clamps `lastSeen`: the most recent
 * bucket is still filling, so its `end` is in the future — without the clamp a
 * reason dropping right now would render as last seen in the future.
 */
export function annotationsToCategorySections(
  droppedAnnotations: Annotation[],
  acceptedAnnotations: Annotation[],
  now: number = Date.now()
): CategorySection[] {
  const reasonsByOutcome = new Map<string, Map<string, ReasonAggregate>>();
  const eventsByOutcome = new Map<string, number>();
  let totalDroppedEvents = 0;

  for (const annotation of droppedAnnotations) {
    const {outcome, reason, eventCount, start, end} = annotation;
    totalDroppedEvents += eventCount;
    eventsByOutcome.set(outcome, (eventsByOutcome.get(outcome) ?? 0) + eventCount);

    const reasons = reasonsByOutcome.get(outcome) ?? new Map<string, ReasonAggregate>();
    const aggregate = reasons.get(reason) ?? {
      events: 0,
      buckets: new Set<number>(),
      lastSeen: 0,
    };
    aggregate.events += eventCount;
    aggregate.buckets.add(start);
    aggregate.lastSeen = Math.max(aggregate.lastSeen, end);
    reasons.set(reason, aggregate);
    reasonsByOutcome.set(outcome, reasons);
  }

  const totalAcceptedEvents = acceptedAnnotations.reduce(
    (sum, annotation) => sum + annotation.eventCount,
    0
  );
  const totalEvents = totalAcceptedEvents + totalDroppedEvents;
  const share = (events: number) => (totalEvents === 0 ? 0 : events / totalEvents);

  const sections: CategorySection[] = [];
  for (const [outcome, reasons] of reasonsByOutcome) {
    const sectionEvents = eventsByOutcome.get(outcome) ?? 0;

    const reasonRows: ReasonRow[] = [];
    for (const [reason, aggregate] of reasons) {
      reasonRows.push({
        outcome,
        reason,
        events: aggregate.events,
        droppedBuckets: aggregate.buckets.size,
        lastSeen: Math.min(aggregate.lastSeen, now),
        shareRatio: share(aggregate.events),
      });
    }
    reasonRows.sort((a, b) => b.events - a.events);

    sections.push({
      outcome,
      label: outcomeLabel(outcome),
      events: sectionEvents,
      shareRatio: share(sectionEvents),
      reasons: reasonRows,
    });
  }
  sections.sort((a, b) => b.events - a.events);

  return sections;
}
