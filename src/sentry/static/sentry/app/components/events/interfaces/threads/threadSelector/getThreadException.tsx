import {Thread} from 'app/types/events';
import {Event, EntryTypeData} from 'app/types';

function getThreadException(thread: Thread, event: Event): EntryTypeData | undefined {
  const exceptionEntry = event.entries.find(entry => entry.type === 'exception');

  if (!exceptionEntry) {
    return undefined;
  }

  const exceptionData = exceptionEntry.data as EntryTypeData;
  const exceptionDataValues = exceptionEntry.data.values;

  if (!exceptionDataValues?.length) {
    return undefined;
  }

  if (exceptionDataValues.length === 1 && !exceptionDataValues[0].threadId) {
    return exceptionData;
  }

  for (const exc of exceptionDataValues) {
    if (exc.threadId === thread.id) {
      return exceptionData;
    }
  }

  return undefined;
}

export default getThreadException;
