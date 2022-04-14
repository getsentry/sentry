import {Entry, EntryType, Event} from 'sentry/types/event';

function isBreadcrumbs(entry: Entry) {
  return entry.type === EntryType.BREADCRUMBS;
}

function eventBreadcrumbEntries(event: Event) {
  return event.entries.filter(isBreadcrumbs);
}
function entryValues(entry: Entry) {
  return entry.data.values;
}

type FilterPredicate = Parameters<typeof Array.prototype.filter>[0];
function not(predicate: FilterPredicate): FilterPredicate {
  return (value, index, array) => !predicate(value, index, array);
}

export default function mergeBreadcrumbsEntries(
  events: Event[],
  rootEvent: Event
): Entry {
  const rrwebEventIds = events.map(({id}) => id);

  const isRRWebTransaction = crumb =>
    crumb.category === 'sentry.transaction' &&
    (rootEvent.id === crumb.message || rrwebEventIds.includes(crumb.message));

  const allValues = events
    .flatMap(eventBreadcrumbEntries)
    .flatMap(entryValues)
    .filter(not(isRRWebTransaction))
    .map(value => JSON.stringify(value));

  const deduped = new Set(allValues);

  return {
    type: EntryType.BREADCRUMBS,
    data: {
      values: Array.from(deduped).map(value => JSON.parse(value)),
    },
  };
}
