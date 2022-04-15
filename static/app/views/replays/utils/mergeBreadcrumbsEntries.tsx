import {Entry, EntryType, Event} from 'sentry/types/event';

function eventBreadcrumbEntries(event: Event) {
  return event.entries.filter(entry => entry.type === EntryType.BREADCRUMBS);
}

function entryValues(entry: Entry) {
  return entry.data.values;
}

export default function mergeBreadcrumbsEntries(
  events: Event[],
  rootEvent: Event
): Entry {
  const rrwebEventIds = events.map(({id}) => id);

  const notRRWebTransaction = crumb =>
    !(
      crumb.category === 'sentry.transaction' &&
      (rootEvent.id === crumb.message || rrwebEventIds.includes(crumb.message))
    );

  const allValues = events
    .flatMap(eventBreadcrumbEntries)
    .flatMap(entryValues)
    .filter(notRRWebTransaction)
    .map(value => JSON.stringify(value));

  const deduped = new Set(allValues);

  return {
    type: EntryType.BREADCRUMBS,
    data: {
      values: Array.from(deduped).map(value => JSON.parse(value)),
    },
  };
}
