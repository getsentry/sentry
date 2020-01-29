import {Thread} from 'app/types/events';
import {Event} from 'app/types';

function getThreadException(thread: Thread, event: Event) {
  if (!event.entries) return;
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
}

export default getThreadException;
