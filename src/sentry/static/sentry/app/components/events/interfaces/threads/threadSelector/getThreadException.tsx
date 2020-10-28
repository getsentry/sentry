import {Thread} from 'app/types/events';
import {Event, EntryTypeData} from 'app/types';

function getThreadException(thread: Thread, event: Event): EntryTypeData | undefined {
  if (!event || !event.entries) {
    return undefined;
  }

  for (const entry of event.entries) {
    if (entry.type !== 'exception') {
      continue;
    }
    for (const exc of entry.data.values) {
      if (exc.threadId === thread.id) {
        return entry.data;
      }
    }
  }

  return undefined;
}

export default getThreadException;
