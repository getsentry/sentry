import type {Event, Thread} from 'sentry/types/event';
import {EntryType} from 'sentry/types/event';
import {defined} from 'sentry/utils/defined';

export function findBestThread(threads: Thread[], event: Event) {
  const threadId = event.entries
    .find(entry => entry.type === EntryType.EXCEPTION)
    ?.data.values?.at(-1)?.threadId;

  return (
    threads.find(thread => defined(threadId) && thread.id === threadId) ||
    threads.find(thread => thread.crashed) ||
    threads.find(thread => thread.stacktrace) ||
    threads[0]
  );
}
