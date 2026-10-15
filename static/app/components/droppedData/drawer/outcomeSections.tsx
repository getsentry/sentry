import {outcomeLabel} from 'sentry/components/droppedData/outcomes';
import type {DroppedEventsBucket} from 'sentry/components/droppedData/types';

export interface ReasonRow {
  category: string;
  events: number;
  outcome: string;
  reason: string;
  shareRatio: number;
}

export interface OutcomeSection {
  events: number;
  label: string;
  outcome: string;
  reasons: ReasonRow[];
  shareRatio: number;
}

interface ReasonTotals {
  category: string;
  events: number;
}
function sumCounts(events: DroppedEventsBucket[]): number {
  return events.reduce((sum, event) => sum + event.count, 0);
}

function byEventsDesc(a: {events: number}, b: {events: number}): number {
  return b.events - a.events;
}

export function droppedEventsToOutcomeSections(
  droppedEvents: DroppedEventsBucket[],
  acceptedEvents: DroppedEventsBucket[]
): OutcomeSection[] {
  const totalEvents = sumCounts(droppedEvents) + sumCounts(acceptedEvents);
  const share = (events: number) => (totalEvents === 0 ? 0 : events / totalEvents);

  const reasonsByOutcome = new Map<string, Map<string, ReasonTotals>>();
  for (const {outcome, reason, category, count} of droppedEvents) {
    const reasons = reasonsByOutcome.get(outcome) ?? new Map<string, ReasonTotals>();
    const totals = reasons.get(reason) ?? {category, events: 0};
    totals.events += count;
    reasons.set(reason, totals);
    reasonsByOutcome.set(outcome, reasons);
  }

  return Array.from(reasonsByOutcome, ([outcome, reasons]): OutcomeSection => {
    const reasonRows = Array.from(reasons, ([reason, {category, events}]): ReasonRow => ({
      outcome,
      reason,
      category,
      events,
      shareRatio: share(events),
    })).sort(byEventsDesc);
    const events = reasonRows.reduce((sum, row) => sum + row.events, 0);

    return {
      outcome,
      label: outcomeLabel(outcome),
      events,
      shareRatio: share(events),
      reasons: reasonRows,
    };
  }).sort(byEventsDesc);
}
