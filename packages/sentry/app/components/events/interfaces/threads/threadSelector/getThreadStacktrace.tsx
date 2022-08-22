import {StacktraceType, Thread} from 'sentry/types';

function getThreadStacktrace(raw: boolean, thread?: Thread): StacktraceType | undefined {
  if (!thread) {
    return undefined;
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
