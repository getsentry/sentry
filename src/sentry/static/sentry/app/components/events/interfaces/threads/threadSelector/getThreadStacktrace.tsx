import {Thread} from 'app/types/events';
import {Event} from 'app/types';
import {StacktraceType} from 'app/types/stacktrace';

import getThreadException from './getThreadException';

function getThreadStacktrace(thread: Thread, event: Event, raw: boolean) {
  const exc = getThreadException(thread, event);
  if (exc) {
    let rv: StacktraceType | undefined = undefined;

    for (const singleExc of exc.values) {
      if (singleExc.threadId === thread.id) {
        rv = singleExc.stacktrace;
        if (raw && singleExc.rawStacktrace) {
          rv = singleExc.rawStacktrace;
        }
      }
    }

    return rv;
  }

  if (raw && thread.rawStacktrace) {
    return thread.rawStacktrace;
  }

  if (thread.stacktrace) {
    return thread.stacktrace;
  }

  return undefined;
}

export default getThreadStacktrace;
