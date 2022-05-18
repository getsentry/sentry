import {getVirtualCrumb} from 'sentry/components/events/interfaces/breadcrumbs/utils';
import {Entry, EntryType, Event} from 'sentry/types/event';

/**
 * Merge all breadcrumbs from each Event in the `events` array
 */
export default function mergeBreadcrumbEntries(events: Event[]): Entry {
  const entries = events.flatMap(event =>
    event.entries.flatMap((entry: Entry) =>
      entry.type === EntryType.BREADCRUMBS ? entry.data.values : []
    )
  );
  const virtualEntries = events.map(getVirtualCrumb).filter(Boolean);

  const stringified = entries.map(value => JSON.stringify(value));
  const deduped = Array.from(new Set(stringified));
  const values = deduped.map(value => JSON.parse(value)).concat(virtualEntries);

  values.sort((a, b) => +new Date(a?.timestamp || 0) - +new Date(b?.timestamp || 0));

  return {
    type: EntryType.BREADCRUMBS,
    data: {
      values,
    },
  };
}
