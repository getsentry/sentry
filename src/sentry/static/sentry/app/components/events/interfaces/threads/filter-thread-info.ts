import {Thread, Frame} from 'app/types/events';
import {Event} from 'app/types';
import {trimPackage} from 'app/components/events/interfaces/frame';

import getThreadStacktrace from './get-thread-stacktrace';
import getRelevantFrame from './get-relevant-frame';
import trimFilename from './trim-filename';

const NOT_FOUND_FRAME = '<unknown>';

interface ThreadInfo {
  label:
    | typeof NOT_FOUND_FRAME
    | {
        type: keyof Omit<Frame, 'filename'>;
        value: string;
      };
  filename?: string;
}

function filterThreadInfo(thread: Thread, event: Event, simplified: boolean): ThreadInfo {
  const stacktrace = getThreadStacktrace(thread, event, simplified);
  const threadInfo: ThreadInfo = {
    label: NOT_FOUND_FRAME,
  };

  if (!stacktrace || stacktrace === null) {
    return threadInfo;
  }

  const relevantFrame: Frame = getRelevantFrame(stacktrace);

  if (relevantFrame.filename) {
    threadInfo.filename = trimFilename(relevantFrame.filename);
  }

  if (relevantFrame.function) {
    threadInfo.label = {
      type: 'function',
      value: relevantFrame.function,
    };
    return threadInfo;
  }

  if (relevantFrame.package) {
    threadInfo.label = {
      type: 'package',
      value: trimPackage(relevantFrame.package),
    };
    return threadInfo;
  }

  if (relevantFrame.module) {
    threadInfo.label = {
      type: 'module',
      value: relevantFrame.module,
    };
    return threadInfo;
  }

  return threadInfo;
}

export default filterThreadInfo;
