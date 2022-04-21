import {Entry, EntryType, Event} from 'sentry/types/event';

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

  const allValues = events.flatMap(event =>
    event.entries.flatMap((entry: Entry) =>
      entry.type === EntryType.BREADCRUMBS
        ? entry.data.values.filter(notRRWebTransaction)
        : []
    )
  );

  const stringified = allValues.map(value => JSON.stringify(value));
  const deduped = Array.from(new Set(stringified));
  const values = deduped.map(value => JSON.parse(value));

  return {
    type: EntryType.BREADCRUMBS,
    data: {
      values,
    },
  };
}
