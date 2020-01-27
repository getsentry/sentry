import {trimPackage} from 'app/components/events/interfaces/frame';
import {Event} from 'app/types';

import {findThreadStacktrace, findRelevantFrame} from './threads';
import trimFilename from './trimFilename';

// TODO -> define all the thread types
export interface Thread {
  id: string;
  name: string;
  crashed: boolean;
  stacktrace?: any;
}

export interface ThreadDetails {
  filename?: string;
  package?: string;
  module?: string;
}
// TODO -> define correct types
interface Frame {
  function: string;
  errors: any;
  colNo: any;
  vars: any;
  package: any;
  absPath: string;
  inApp: boolean;
  lineNo: number;
  module: any;
  filename: string;
  platform: null;
  instructionAddr: string;
  context: any;
  symbolAddr: any;
  trust: any;
  symbol: any;
  rawFunction: any;
}

// TODO -> define event interface
function getThreadDetails(thread: Thread, event: Event): ThreadDetails {
  const stacktrace = findThreadStacktrace(thread, event, false);
  const threadDetails: ThreadDetails = {};

  if (!stacktrace) return threadDetails;

  const relevantFrame: Frame = findRelevantFrame(stacktrace);

  if (relevantFrame.filename) {
    threadDetails.filename = trimFilename(relevantFrame.filename);
  }

  if (relevantFrame.package) {
    threadDetails.package = trimPackage(relevantFrame.package);
  }

  if (relevantFrame.module) {
    threadDetails.module = relevantFrame.module;
  }

  return threadDetails;
}

export default getThreadDetails;
