import {Event, EventTransaction} from 'app/types/event';

export function isTransaction(event: Event): event is EventTransaction {
  return event.type === 'transaction';
}
