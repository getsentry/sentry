import {Event, ExceptionType, ExceptionValue, Thread} from 'sentry/types';
import {defined} from 'sentry/utils';

function getException(
  exceptionData: ExceptionType,
  exceptionDataValues: ExceptionValue[],
  thread: Thread
) {
  if (exceptionDataValues.length === 1 && !exceptionDataValues[0].stacktrace) {
    return {
      ...exceptionData,
      values: [
        {
          ...exceptionDataValues[0],
          stacktrace: thread.stacktrace,
          rawStacktrace: thread.rawStacktrace,
        },
      ],
    };
  }

  const exceptionHasAtLeastOneStacktrace = !!exceptionDataValues.find(
    exceptionDataValue => exceptionDataValue.stacktrace
  );

  if (exceptionHasAtLeastOneStacktrace) {
    return exceptionData as Required<ExceptionType>;
  }

  return undefined;
}

function getThreadException(
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
    return getException(exceptionData, exceptionDataValues, thread);
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

export default getThreadException;
