import {type Entry as TEntry, EntryType} from 'sentry/types';

export function EventEntry(params = {}): TEntry {
  return {
    type: EntryType.MESSAGE,
    data: {
      formatted: 'Blocked script',
    },
    ...params,
  };
}
