import {Thread} from 'app/types/events';
import {Event, ExceptionType} from 'app/types';

function getThreadException(thread: Thread, event: Event): ExceptionType | undefined {
  const exceptionEntry = event.entries.find(entry => entry.type === 'exception');

  if (!exceptionEntry) {
    return undefined;
  }

  const exceptionData = exceptionEntry.data as ExceptionType;
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
