import isNil from 'lodash/isNil';

import {
  getMappedThreadState,
  ThreadStates,
} from 'sentry/components/events/interfaces/threads/threadSelector/threadStates';
import {t} from 'sentry/locale';
import {EntryException, EntryThreads, EntryType, Event, Frame} from 'sentry/types';

type SuspectFrame = {
  helpText: string;
  module: string;
  exceptionMessage?: string;
  functions?: string[];
  offendingThreadStates?: ThreadStates[];
};

const CULPRIT_FRAMES: SuspectFrame[] = [
  {
    module: 'libcore.io.Linux',
    functions: ['read', 'write', 'fstat', 'fsync', 'fdatasync', 'access', 'open'],
    offendingThreadStates: [ThreadStates.WAITING, ThreadStates.TIMED_WAITING],
    helpText: t('Move File I/O off the main thread'),
  },
  {
    module: 'android.database.sqlite.SQLiteConnection',
    functions: [
      'nativeOpen',
      'nativeExecute',
      'nativeExecuteFor{something}',
      'nativeBind{something}',
      'nativeGet{something}',
    ],
    offendingThreadStates: [ThreadStates.WAITING, ThreadStates.TIMED_WAITING],
    helpText: t('Move database operations off the main thread'),
  },
  {
    module: 'android.app.SharedPreferencesImpl$EditorImpl$([0-9])',
    functions: ['commit'],
    offendingThreadStates: [ThreadStates.WAITING, ThreadStates.TIMED_WAITING],
    helpText: t(
      'Switch to SharedPreferences.apply or move commit to a background thread'
    ),
  },
  {
    module: 'android.app.SharedPreferencesImpl$EditorImpl$([0-9])',
    functions: ['run'],
    offendingThreadStates: [ThreadStates.WAITING, ThreadStates.TIMED_WAITING],
    helpText: t(
      'Switch to SharedPreferences.commit and move this to a background thread'
    ),
  },
];

function satisfiesModule(frame: Frame, suspect: SuspectFrame) {
  if (isNil(suspect.module)) {
    return true;
  }
  return frame.module?.startsWith(suspect.module);
}

function satisfiesFunction(frame: Frame, suspect: SuspectFrame) {
  if (isNil(suspect.functions) || suspect.functions.length === 0) {
    return true;
  }
  return frame.function && suspect.functions.includes(frame.function);
}

function satisfiesOffendingThreadConditions(
  threadState: string | undefined | null,
  suspect: SuspectFrame
) {
  if (
    isNil(suspect.offendingThreadStates) ||
    suspect.offendingThreadStates.length === 0
  ) {
    return true;
  }
  const mappedState = getMappedThreadState(threadState);
  return mappedState && suspect.offendingThreadStates.includes(mappedState);
}

export function analyzeFrames(event: Event) {
  const exception = event.entries.find(entry => entry.type === EntryType.EXCEPTION) as
    | EntryException
    | undefined;
  if (isNil(exception)) {
    return null;
  }

  const exceptionFrames = exception.data.values?.[0]?.stacktrace?.frames;

  if (isNil(exceptionFrames)) {
    return null;
  }

  const threads = event.entries.find(entry => entry.type === EntryType.THREADS) as
    | EntryThreads
    | undefined;
  const currentThread = threads?.data.values?.find(thread => thread.current);

  let culprit: SuspectFrame | undefined = undefined;
  for (let index = 0; index < exceptionFrames.length; index++) {
    const frame = exceptionFrames[index];
    for (let culpritIndex = 0; culpritIndex < CULPRIT_FRAMES.length; culpritIndex++) {
      const possibleCulprit = CULPRIT_FRAMES[culpritIndex];
      if (
        satisfiesModule(frame, possibleCulprit) &&
        satisfiesFunction(frame, possibleCulprit) &&
        satisfiesOffendingThreadConditions(currentThread?.state, possibleCulprit)
      ) {
        culprit = possibleCulprit;
        break;
      }
    }
  }

  if (!isNil(culprit)) {
    return culprit;
  }

  return exceptionFrames;
}
