import {getThreadException} from 'sentry/components/events/interfaces/threads/threadSelector/getThreadException';
import {
  inferPlatform,
  isStacktraceNewestFirst,
} from 'sentry/components/events/interfaces/utils';
import type {StackTraceMeta, StackTraceView} from 'sentry/components/stackTrace/types';
import type {Event, ExceptionValue, Thread} from 'sentry/types/event';
import {EntryType} from 'sentry/types/event';
import {defined} from 'sentry/utils/defined';

function getThreadStacktraceMeta({
  activeThread,
  event,
}: {
  activeThread: Thread | undefined;
  event: Event;
}): StackTraceMeta | undefined {
  const entryIndex = event.entries.findIndex(entry => entry.type === EntryType.THREADS);
  const threadsEntry = event.entries[entryIndex];
  const threadIndex =
    threadsEntry?.type === EntryType.THREADS
      ? (threadsEntry.data.values ?? []).findIndex(
          thread => thread.id === activeThread?.id
        )
      : -1;

  return event._meta?.entries?.[entryIndex]?.data?.values?.[threadIndex]?.stacktrace;
}

/**
 * Exceptions that belong in the active thread's text: its own plus unassigned
 * ones, with the thread's frames attached to the exception that lacks them.
 * Other threads' exceptions are left out.
 */
function getThreadTextExceptionValues({
  activeThread,
  event,
}: {
  activeThread: Thread | undefined;
  event: Event;
}): ExceptionValue[] | undefined {
  if (!activeThread) {
    return undefined;
  }

  const exceptionEntry = event.entries.find(entry => entry.type === EntryType.EXCEPTION);
  const exceptionValues =
    exceptionEntry?.type === EntryType.EXCEPTION
      ? (exceptionEntry.data.values ?? [])
      : [];
  const values = exceptionValues.filter(
    value => !defined(value.threadId) || value.threadId === activeThread.id
  );
  const threadException = values.findLast(value => value.threadId === activeThread.id);

  if (!values.length || (!threadException && !activeThread.crashed)) {
    return undefined;
  }

  const exceptionWithThreadFrames = threadException ?? values.at(-1);
  return values.map(value =>
    value === exceptionWithThreadFrames && !value.stacktrace
      ? {
          ...value,
          stacktrace: activeThread.stacktrace,
          rawStacktrace: value.rawStacktrace ?? activeThread.rawStacktrace,
        }
      : value
  );
}

export function getActiveThreadStackTraceModel({
  activeThread,
  event,
}: {
  activeThread: Thread | undefined;
  event: Event;
}) {
  const exception = getThreadException(event, activeThread);
  const activeException =
    exception?.values.find(value => value.threadId === activeThread?.id) ??
    exception?.values[0];
  const platform = inferPlatform(event, activeThread);
  const hasMinifiedStacktrace =
    !!activeThread?.rawStacktrace ||
    !!exception?.values.some(value => !!value.rawStacktrace);
  const hasSystemFrames = exception
    ? exception.values.some(value => !!value.stacktrace?.hasSystemFrames)
    : !!activeThread?.stacktrace?.hasSystemFrames;
  const defaultView: StackTraceView = hasSystemFrames ? 'app' : 'full';

  return {
    activeException,
    activeThread,
    defaultIsNewestFirst: isStacktraceNewestFirst(),
    defaultView,
    exception,
    hasMinifiedStacktrace,
    minifiedStacktrace:
      activeException?.rawStacktrace ?? activeThread?.rawStacktrace ?? undefined,
    platform,
    stacktrace: activeException?.stacktrace ?? activeThread?.stacktrace ?? undefined,
    stacktraceMeta: getThreadStacktraceMeta({activeThread, event}),
    textExceptionValues: getThreadTextExceptionValues({activeThread, event}),
  };
}

export type ActiveThreadStackTraceModel = ReturnType<
  typeof getActiveThreadStackTraceModel
>;
