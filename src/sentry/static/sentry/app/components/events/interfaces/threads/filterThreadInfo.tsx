import {Thread, Frame} from 'app/types/events';
import {Event} from 'app/types';
import {trimPackage} from 'app/components/events/interfaces/frame/utils';

import getThreadStacktrace from './getThreadStacktrace';
import getRelevantFrame from './getRelevantFrame';
import trimFilename from './trimFilename';

// TODO(i18n): add traslations here
const NOT_FOUND_FRAME = '<unknown>';

type ThreadInfo = {
  label: string;
  filename?: string;
};

function filterThreadInfo(thread: Thread, event: Event): ThreadInfo {
  const stacktrace = getThreadStacktrace(thread, event, false);
  const threadInfo: ThreadInfo = {
    label: NOT_FOUND_FRAME,
  };

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
