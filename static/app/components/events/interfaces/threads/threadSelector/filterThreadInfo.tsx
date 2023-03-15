import {trimPackage} from 'sentry/components/events/interfaces/frame/utils';
import {
  getMappedThreadState,
  ThreadStates,
} from 'sentry/components/events/interfaces/threads/threadSelector/threadStates';
import {
  EntryData,
  Event,
  ExceptionType,
  Frame,
  StacktraceType,
  Thread,
} from 'sentry/types';

import getRelevantFrame from './getRelevantFrame';
import getThreadException from './getThreadException';
import getThreadStacktrace from './getThreadStacktrace';
import trimFilename from './trimFilename';

type ThreadInfo = {
  crashedInfo?: EntryData;
  filename?: string;
  label?: string;
  state?: ThreadStates;
};

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
