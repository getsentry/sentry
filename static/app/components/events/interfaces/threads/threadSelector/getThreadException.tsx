import type {Event, ExceptionType, ExceptionValue, Thread} from 'sentry/types/event';
import {defined} from 'sentry/utils/defined';

function getException(
  exceptionData: ExceptionType,
  exceptionDataValues: ExceptionValue[],
  thread: Thread
) {
  // Exception chains are ordered oldest to newest.
  const threadException =
    exceptionDataValues.findLast(value => value.threadId === thread.id) ??
    exceptionDataValues.at(-1);

  return {
    ...exceptionData,
    values: exceptionDataValues.map(value =>
      value === threadException && !value.stacktrace
        ? {
            ...value,
            stacktrace: thread.stacktrace,
            rawStacktrace: thread.rawStacktrace,
          }
        : value
    ),
  };
}

export function getThreadException(
  event: Event,
  thread?: Thread
): Required<ExceptionType> | undefined {
  const exceptionEntry = event.entries.find(entry => entry.type === 'exception');

  if (!exceptionEntry) {
    return undefined;
  }

  const exceptionData = exceptionEntry.data as ExceptionType;
  const exceptionDataValues = exceptionData.values;

  if (!exceptionDataValues?.length || !thread) {
    return undefined;
  }

  const matchedStacktraceAndExceptionThread = exceptionDataValues.find(
    exceptionDataValue => exceptionDataValue.threadId === thread.id
  );

  if (matchedStacktraceAndExceptionThread) {
    return getException(
      exceptionData,
      exceptionDataValues.filter(
        value => !defined(value.threadId) || value.threadId === thread.id
      ),
      thread
    );
  }

  if (
    exceptionDataValues.every(
      exceptionDataValue => !defined(exceptionDataValue.threadId)
    ) &&
    thread.crashed
  ) {
    return getException(exceptionData, exceptionDataValues, thread);
  }

  return undefined;
}
