import {outcomeLabel} from 'sentry/components/droppedData/outcomes';
import type {DroppedEventsBucket} from 'sentry/components/droppedData/types';

export interface ReasonRow {
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

function sumCounts(events: DroppedEventsBucket[]): number {
  return events.reduce((sum, event) => sum + event.count, 0);
}

function byEventsDesc(a: {events: number}, b: {events: number}): number {
  return b.events - a.events;
}

export interface OutcomeGroups {
  intentional: OutcomeSection[];
  unintentional: OutcomeSection[];
}

export type DroppedDataScope = 'contributing' | 'all';

function isUnintentional(event: DroppedEventsBucket): boolean {
  return event.tags.includes('unintentional');
}

export function filterDroppedEventsByScope(
  droppedEvents: DroppedEventsBucket[],
  scope: DroppedDataScope
): DroppedEventsBucket[] {
  return scope === 'all' ? droppedEvents : droppedEvents.filter(isUnintentional);
}

export function droppedEventsToOutcomeSections(
  droppedEvents: DroppedEventsBucket[],
  acceptedEvents: DroppedEventsBucket[]
): OutcomeSection[] {
  const totalEvents = sumCounts(droppedEvents) + sumCounts(acceptedEvents);
  return buildOutcomeSections(droppedEvents, totalEvents);
}

export function droppedEventsToOutcomeGroups(
  droppedEvents: DroppedEventsBucket[],
  acceptedEvents: DroppedEventsBucket[],
  scope: DroppedDataScope
): OutcomeGroups {
  const scopedEvents = filterDroppedEventsByScope(droppedEvents, scope);
  const totalEvents = sumCounts(scopedEvents) + sumCounts(acceptedEvents);
  const unintentional: DroppedEventsBucket[] = [];
  const intentional: DroppedEventsBucket[] = [];
  for (const event of scopedEvents) {
    if (isUnintentional(event)) {
      unintentional.push(event);
    } else {
      intentional.push(event);
    }
  }

  return {
    unintentional: buildOutcomeSections(unintentional, totalEvents),
    intentional: buildOutcomeSections(intentional, totalEvents),
  };
}

function buildOutcomeSections(
  droppedEvents: DroppedEventsBucket[],
  totalEvents: number
): OutcomeSection[] {
  const share = (events: number) => (totalEvents === 0 ? 0 : events / totalEvents);

  const reasonsByOutcome = new Map<string, Map<string, number>>();
  for (const {outcome, reason, count} of droppedEvents) {
    const reasons = reasonsByOutcome.get(outcome) ?? new Map<string, number>();
    reasons.set(reason, (reasons.get(reason) ?? 0) + count);
    reasonsByOutcome.set(outcome, reasons);
  }

  return Array.from(reasonsByOutcome, ([outcome, reasons]): OutcomeSection => {
    const reasonRows = Array.from(reasons, ([reason, events]): ReasonRow => ({
      outcome,
      reason,
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
