import {getFileName} from 'sentry/components/events/interfaces/debugMeta/utils';
import {trimPackage} from 'sentry/components/events/interfaces/frame/utils';
import type {ThreadStates} from 'sentry/components/events/interfaces/threads/threadSelector/threadStates';
import {getMappedThreadState} from 'sentry/components/events/interfaces/threads/threadSelector/threadStates';
import type {Event, ExceptionType, Frame, Thread} from 'sentry/types/event';
import type {EntryData} from 'sentry/types/group';
import type {StacktraceType} from 'sentry/types/stacktrace';

import {getThreadException} from './getThreadException';
import {getThreadStacktrace} from './getThreadStacktrace';

export interface ThreadInfo {
  /**
   * The full exception entry associated with a crashed thread. Only set when
   * the thread crashed and an exception was available for the event.
   */
  crashedInfo?: EntryData;
  /**
   * Basename of the relevant frame's file (last path segment, Windows or Unix).
   */
  filename?: string;
  /**
   * Human-readable label for the thread, derived from the relevant frame's
   * function, package, or module (in that priority order).
   */
  label?: string;
  /**
   * Normalized thread state (e.g. runnable, blocked) mapped from the raw
   * platform-specific state string.
   */
  state?: ThreadStates;
}

function getRelevantFrame(stacktrace: StacktraceType): Frame | undefined {
  const frames = stacktrace.frames;
  if (!frames?.length) {
    return undefined;
  }

  if (stacktrace.hasSystemFrames) {
    const lastInAppFrame = frames.findLast(frame => frame.inApp);
    if (lastInAppFrame) {
      return lastInAppFrame;
    }
  }

  return frames.at(-1);
}

export function getThreadInfo(
  event: Event,
  thread: Thread,
  exception?: Required<ExceptionType>
): ThreadInfo {
  const threadInfo: ThreadInfo = {
    state: getMappedThreadState(thread.state),
  };

  let stacktrace = getThreadStacktrace(false, thread);

  if (thread.crashed) {
    const threadException = exception ?? getThreadException(event, thread);
    const matchedException = threadException?.values.find(
      exceptionDataValue => exceptionDataValue.threadId === thread.id
    );

    // If an exception entry matches this thread, prefer its stacktrace.
    // Otherwise keep the non-crashed stacktrace as a fallback - we still
    // attach the full exception as crashedInfo so callers have the context.
    if (matchedException) {
      stacktrace = matchedException.stacktrace ?? undefined;
    }

    if (threadException) {
      threadInfo.crashedInfo = threadException;
    }
  }

  if (!stacktrace) {
    return threadInfo;
  }

  const relevantFrame = getRelevantFrame(stacktrace);
  if (!relevantFrame) {
    return threadInfo;
  }

  if (relevantFrame.filename) {
    threadInfo.filename = getFileName(relevantFrame.filename);
  }

  if (relevantFrame.function) {
    threadInfo.label = relevantFrame.function;
    return threadInfo;
  }

  if (relevantFrame.package) {
    threadInfo.label = trimPackage(relevantFrame.package);
    return threadInfo;
  }

  if (relevantFrame.module) {
    threadInfo.label = relevantFrame.module;
    return threadInfo;
  }

  return threadInfo;
}
