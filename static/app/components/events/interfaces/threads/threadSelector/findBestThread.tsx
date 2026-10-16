import type {Event, ExceptionType, Thread} from 'sentry/types/event';
import {EntryType} from 'sentry/types/event';
import {defined} from 'sentry/utils/defined';

export function findBestThread(threads: Thread[], event: Event) {
  // honor exception thread selection before crashed or stack trace fallbacks
  const exceptions: ExceptionType['values'] = event.entries.find(
    entry => entry.type === EntryType.EXCEPTION
  )?.data.values;
  const minidumpId = exceptions?.find(
    exception => exception.mechanism?.type === 'minidump'
  )?.threadId;
  const exceptionId = exceptions?.findLast(exception =>
    threads.some(
      thread => defined(exception.threadId) && thread.id === exception.threadId
    )
  )?.threadId;

  return (
    threads.find(thread => defined(minidumpId) && thread.id === minidumpId) ||
    threads.find(thread => defined(exceptionId) && thread.id === exceptionId) ||
    threads.find(thread => thread.crashed) ||
    threads.find(thread => thread.stacktrace) ||
    threads[0]
  );
}
