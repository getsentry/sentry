import {Event, ExceptionType} from 'app/types';
import {Thread} from 'app/types/events';
import {defined} from 'app/utils';

function getThreadException(
  thread: Thread,
  event: Event
): Required<ExceptionType> | undefined {
  const exceptionEntry = event.entries.find(entry => entry.type === 'exception');

  if (!exceptionEntry) {
    return undefined;
  }

  const exceptionData = exceptionEntry.data as ExceptionType;
  const exceptionDataValues = exceptionData.values;

  if (!exceptionDataValues?.length) {
    return undefined;
  }

  if (exceptionDataValues.length === 1 && !defined(exceptionDataValues[0].threadId)) {
    if (!exceptionDataValues[0].stacktrace) {
      return undefined;
    }
    return exceptionData as Required<ExceptionType>;
  }

  for (const exc of exceptionDataValues) {
    if (exc.threadId === thread.id && exc.stacktrace) {
      return exceptionData as Required<ExceptionType>;
    }
  }

  return undefined;
}

export default getThreadException;
