import {trimPackage} from 'sentry/components/events/interfaces/frame/utils';
import type {ThreadStates} from 'sentry/components/events/interfaces/threads/threadSelector/threadStates';
import {getMappedThreadState} from 'sentry/components/events/interfaces/threads/threadSelector/threadStates';
import type {Event, ExceptionType, Frame, Thread} from 'sentry/types/event';
import type {EntryData} from 'sentry/types/group';
import type {StacktraceType} from 'sentry/types/stacktrace';

import getRelevantFrame from './getRelevantFrame';
import getThreadException from './getThreadException';
import getThreadStacktrace from './getThreadStacktrace';

export type ThreadInfo = {
  crashedInfo?: EntryData;
  filename?: string;
  label?: string;
  state?: ThreadStates;
};

function trimFilename(filename: string) {
  const pieces = filename.split(/\//g);
  return pieces[pieces.length - 1];
}

function filterThreadInfo(
  event: Event,
  thread: Thread,
  exception?: Required<ExceptionType>
): ThreadInfo {
  const threadInfo: ThreadInfo = {};
  threadInfo.state = getMappedThreadState(thread.state);

  let stacktrace: StacktraceType | undefined = getThreadStacktrace(false, thread);

  if (thread.crashed) {
    const threadException = exception ?? getThreadException(event, thread);

    const matchedStacktraceAndExceptionThread = threadException?.values.find(
      exceptionDataValue => exceptionDataValue.threadId === thread.id
    );

    if (matchedStacktraceAndExceptionThread) {
      stacktrace = matchedStacktraceAndExceptionThread.stacktrace ?? undefined;
    }

    threadInfo.crashedInfo = threadException;
  }

  if (!stacktrace) {
    return threadInfo;
  }

  const relevantFrame: Frame = getRelevantFrame(stacktrace);

  if (relevantFrame.filename) {
    threadInfo.filename = trimFilename(relevantFrame.filename);
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

export default filterThreadInfo;
