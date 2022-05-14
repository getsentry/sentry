import {Entry, EntryType, Event} from 'sentry/types/event';

/**
 * Merge all breadcrumbs from each Event in the `events` array
 */
export default function mergeBreadcrumbEntries(events: Event[]): Entry {
  const allValues = events.flatMap(event =>
    event.entries.flatMap((entry: Entry) =>
      entry.type === EntryType.BREADCRUMBS ? entry.data.values : []
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
