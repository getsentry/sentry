import {Event, EventTransaction} from 'app/types/event';

import {TraceLite} from './quickTraceQuery';

export function isTransaction(event: Event): event is EventTransaction {
  return event.type === 'transaction';
}

export function parseTraceLite(trace: TraceLite, event: Event) {
  const root = trace.find(e => e.is_root && e.event_id !== event.id) ?? null;
  const current = trace.find(e => e.event_id === event.id) ?? null;
  const children = trace.filter(e => e.parent_event_id === event.id);
  return {
    root,
    current,
    children,
  };
}
