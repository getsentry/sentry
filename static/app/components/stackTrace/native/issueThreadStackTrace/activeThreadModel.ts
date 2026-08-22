import {getThreadException} from 'sentry/components/events/interfaces/threads/threadSelector/getThreadException';
import {
  inferPlatform,
  isStacktraceNewestFirst,
} from 'sentry/components/events/interfaces/utils';
import type {StackTraceMeta, StackTraceView} from 'sentry/components/stackTrace/types';
import type {Event, ExceptionValue, Thread} from 'sentry/types/event';
import {EntryType} from 'sentry/types/event';
import type {StacktraceType} from 'sentry/types/stacktrace';

function getEntryIndex(event: Event, type: EntryType) {
  return event.entries.findIndex(entry => entry.type === type);
}

function getExceptionStacktraceMeta({
  activeException,
  event,
}: {
  activeException: ExceptionValue;
  event: Event;
}): StackTraceMeta | undefined {
  const entryIndex = getEntryIndex(event, EntryType.EXCEPTION);
  const exceptionEntry = event.entries[entryIndex];
  const exceptionValues =
    exceptionEntry?.type === EntryType.EXCEPTION
      ? (exceptionEntry.data.values ?? [])
      : [];
  let exceptionIndex = exceptionValues.indexOf(activeException);

  if (exceptionIndex === -1 && activeException.threadId !== null) {
    exceptionIndex = exceptionValues.findIndex(
      value => value.threadId === activeException.threadId
    );
  }
  if (exceptionIndex === -1 && exceptionValues.length === 1) {
    exceptionIndex = 0;
  }

  return event._meta?.entries?.[entryIndex]?.data?.values?.[exceptionIndex]?.stacktrace;
}

function getThreadStacktraceMeta({
  activeThread,
  event,
}: {
  activeThread: Thread | undefined;
  event: Event;
}): StackTraceMeta | undefined {
  const entryIndex = getEntryIndex(event, EntryType.THREADS);
  const threadsEntry = event.entries[entryIndex];
  const threadIndex =
    threadsEntry?.type === EntryType.THREADS
      ? (threadsEntry.data.values ?? []).findIndex(
          thread => thread.id === activeThread?.id
        )
      : -1;

  return event._meta?.entries?.[entryIndex]?.data?.values?.[threadIndex]?.stacktrace;
}

function getActiveStacktraceMeta({
  activeException,
  activeThread,
  event,
}: {
  activeException: ExceptionValue | undefined;
  activeThread: Thread | undefined;
  event: Event;
}): StackTraceMeta | undefined {
  if (activeException) {
    return getExceptionStacktraceMeta({activeException, event});
  }

  return getThreadStacktraceMeta({activeThread, event});
}

function getActiveExceptionValue({
  activeThread,
  exceptionValues,
}: {
  activeThread: Thread | undefined;
  exceptionValues: ExceptionValue[];
}): ExceptionValue | undefined {
  return (
    exceptionValues.find(value => value.threadId === activeThread?.id) ??
    exceptionValues[0]
  );
}

function getActiveStacktrace({
  activeException,
  activeThread,
}: {
  activeException: ExceptionValue | undefined;
  activeThread: Thread | undefined;
}): {
  minifiedStacktrace: StacktraceType | undefined;
  stacktrace: StacktraceType | undefined;
} {
  return {
    stacktrace: activeException?.stacktrace ?? activeThread?.stacktrace ?? undefined,
    minifiedStacktrace:
      activeException?.rawStacktrace ?? activeThread?.rawStacktrace ?? undefined,
  };
}

function getDefaultView({
  activeThread,
  exception,
}: {
  activeThread: Thread | undefined;
  exception: ReturnType<typeof getThreadException>;
}): StackTraceView {
  if (exception) {
    return exception.values.some(value => !!value.stacktrace?.hasSystemFrames)
      ? 'app'
      : 'full';
  }

  return activeThread?.stacktrace?.hasSystemFrames ? 'app' : 'full';
}

export function getActiveThreadStackTraceModel({
  activeThread,
  event,
}: {
  activeThread: Thread | undefined;
  event: Event;
}) {
  const exception = getThreadException(event, activeThread);
  const activeException = getActiveExceptionValue({
    activeThread,
    exceptionValues: exception?.values ?? [],
  });
  const {minifiedStacktrace, stacktrace} = getActiveStacktrace({
    activeException,
    activeThread,
  });
  const platform = inferPlatform(event, activeThread);
  const hasMinifiedStacktrace =
    !!activeThread?.rawStacktrace ||
    !!exception?.values.some(value => !!value.rawStacktrace);

  return {
    activeException,
    activeThread,
    defaultIsNewestFirst: isStacktraceNewestFirst(),
    defaultView: getDefaultView({activeThread, exception}),
    exception,
    hasMinifiedStacktrace,
    minifiedStacktrace,
    platform,
    stacktrace,
    stacktraceMeta: getActiveStacktraceMeta({activeException, activeThread, event}),
  };
}

export type ActiveThreadStackTraceModel = ReturnType<
  typeof getActiveThreadStackTraceModel
>;
