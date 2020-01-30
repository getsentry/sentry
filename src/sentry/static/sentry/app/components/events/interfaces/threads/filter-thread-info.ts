import {Thread, Frame} from 'app/types/events';
import {Event} from 'app/types';
import {trimPackage} from 'app/components/events/interfaces/frame';

import getThreadStacktrace from './get-thread-stacktrace';
import getRelevantFrame from './get-relevant-frame';
import trimFilename from './trim-filename';

function filterThreadInfo(thread: Thread, event: Event, simplified: boolean) {
  const stacktrace = getThreadStacktrace(thread, event, simplified);
  const threadInfo: Frame = {};

  if (!stacktrace || stacktrace === null) return threadInfo;

  const relevantFrame: Frame = getRelevantFrame(stacktrace);

  if (relevantFrame.function) {
    threadInfo.function = relevantFrame.function;
  }

  if (relevantFrame.filename) {
    threadInfo.filename = trimFilename(relevantFrame.filename);
  }

  if (relevantFrame.package) {
    threadInfo.package = trimPackage(relevantFrame.package);
  }

  if (relevantFrame.module) {
    threadInfo.module = relevantFrame.module;
  }

  return threadInfo;
}

export default filterThreadInfo;
