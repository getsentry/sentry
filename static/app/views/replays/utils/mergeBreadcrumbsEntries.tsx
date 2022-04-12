import {Entry, EntryType, Event} from 'sentry/types/event';

function isBreadcrumbs(entry: Entry) {
  return entry.type === EntryType.BREADCRUMBS;
}

export default function mergeBreadcrumbsEntries(events: Event[]): Entry {
  const allValues = events
    .flatMap(event => event.entries.filter(isBreadcrumbs))
    .flatMap(entry => entry.data.values)
    .map(value => JSON.stringify(value));
  const deduped = new Set(allValues);

  return {
    type: EntryType.BREADCRUMBS,
    data: {
      values: Array.from(deduped).map(value => JSON.parse(value)),
    },
  };
}
