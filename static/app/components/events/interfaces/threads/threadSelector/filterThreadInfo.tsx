import {trimPackage} from 'app/components/events/interfaces/frame/utils';
import {EntryData, ExceptionType, Frame} from 'app/types';
import {Event} from 'app/types/event';
import {Thread} from 'app/types/events';
import {StacktraceType} from 'app/types/stacktrace';

import getRelevantFrame from './getRelevantFrame';
import getThreadException from './getThreadException';
import getThreadStacktrace from './getThreadStacktrace';
import trimFilename from './trimFilename';

type ThreadInfo = {
  label?: string;
  filename?: string;
  crashedInfo?: EntryData;
};

function filterThreadInfo(
  event: Event,
  thread: Thread,
  exception?: Required<ExceptionType>
): ThreadInfo {
  const threadInfo: ThreadInfo = {};

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
