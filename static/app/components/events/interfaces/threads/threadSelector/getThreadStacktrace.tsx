import type {Thread} from 'sentry/types/event';
import type {StacktraceType} from 'sentry/types/stacktrace';

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
