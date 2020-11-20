import {Event, ExceptionValue} from 'app/types';
import {Thread} from 'app/types/events';

import getThreadException from './getThreadException';

function getThreadStacktrace(thread: Thread, event: Event, raw: boolean) {
  const exc = getThreadException(thread, event);
  if (exc) {
    let rv: ExceptionValue['stacktrace'] | undefined = undefined;

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
