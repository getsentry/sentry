import isNil from 'lodash/isNil';

import {
  getMappedThreadState,
  ThreadStates,
} from 'sentry/components/events/interfaces/threads/threadSelector/threadStates';
import ExternalLink from 'sentry/components/links/externalLink';
import {t, tct} from 'sentry/locale';
import {EntryException, EntryThreads, EntryType, Event, Frame} from 'sentry/types';

type SuspectFrame = {
  module: string | RegExp;
  resources: React.ReactNode;
  exceptionMessage?: string;
  functions?: (string | RegExp)[];
  offendingThreadStates?: ThreadStates[];
};

const CULPRIT_FRAMES: SuspectFrame[] = [
  {
    module: 'libcore.io.Linux',
    functions: ['read', 'write', 'fstat', 'fsync', 'fdatasync', 'access', 'open'],
    offendingThreadStates: [ThreadStates.WAITING, ThreadStates.TIMED_WAITING],
    resources: t('Move File I/O off the main thread.'),
  },
  {
    module: 'android.database.sqlite.SQLiteConnection',
    functions: [
      'nativeOpen',
      'nativeExecute',
      /nativeExecuteFor[a-zA-Z]+/,
      /nativeBind[a-zA-Z]+/,
      /nativeGet[a-zA-Z]+/,
    ],
    offendingThreadStates: [ThreadStates.WAITING, ThreadStates.TIMED_WAITING],
    resources: t('Move database operations off the main thread.'),
  },
  {
    module: 'android.app.SharedPreferencesImpl$EditorImpl',
    functions: ['commit'],
    offendingThreadStates: [ThreadStates.WAITING, ThreadStates.TIMED_WAITING],
    resources: t(
      'Switch to SharedPreferences.apply or move commit to a background thread.'
    ),
  },
  {
    module: /^android\.app\.SharedPreferencesImpl\$EditorImpl\$[0-9]/,
    functions: ['run'],
    offendingThreadStates: [ThreadStates.WAITING, ThreadStates.TIMED_WAITING],
    resources: t(
      'Switch to SharedPreferences.commit and move commit to a background thread.'
    ),
  },
  {
    module: 'android.app.Instrumentation.callApplicationOnCreate',
    functions: ['onCreate'],
    offendingThreadStates: [
      ThreadStates.WAITING,
      ThreadStates.TIMED_WAITING,
      ThreadStates.RUNNABLE,
    ],
    resources: tct(
      'Optimize cold/warm app starts by offloading operations off the main thread and [link:lazily initializing] components.',
      {
        link: (
          <ExternalLink href="https://developer.android.com/topic/performance/vitals/launch-time#heavy-app" />
        ),
      }
    ),
  },
  {
    module: 'android.content.res.AssetManager',
    functions: [
      'nativeOpenAsset',
      'nativeOpenAssetFd',
      'nativeOpenNonAsset',
      'nativeOpenNonAssetFd',
    ],
    offendingThreadStates: [
      ThreadStates.WAITING,
      ThreadStates.TIMED_WAITING,
      ThreadStates.RUNNABLE,
    ],
    resources: t('If possible, move loading heavy assets off the main thread.'),
  },
  {
    module: 'android.content.res.AssetManager',
    functions: [/^nativeGetResource[a-zA-Z]+/],
    offendingThreadStates: [
      ThreadStates.WAITING,
      ThreadStates.TIMED_WAITING,
      ThreadStates.RUNNABLE,
    ],
    resources: t('Look for heavy resources in the /res or /res/raw folders.'),
  },
  {
    module: 'android.view.LayoutInflater.inflate',
    offendingThreadStates: [
      ThreadStates.WAITING,
      ThreadStates.TIMED_WAITING,
      ThreadStates.RUNNABLE,
    ],
    resources: tct(
      'The app is potentially inflating a heavy, deeply-nested layout. [link:Optimize view hierarchy], use view stubs, use include/merge tags for reusing inflated views.',
      {
        link: (
          <ExternalLink href="https://developer.android.com/develop/ui/views/layout/improving-layouts" />
        ),
      }
    ),
  },
];

function satisfiesModuleCondition(frame: Frame, suspect: SuspectFrame) {
  if (isNil(suspect.module)) {
    return true;
  }
  const matchFuction = suspect.module;
  return typeof matchFuction === 'string'
    ? frame.module?.startsWith(matchFuction)
    : frame.module && matchFuction.test(frame.module);
}

function satisfiesFunctionCondition(frame: Frame, suspect: SuspectFrame) {
  if (isNil(suspect.functions) || suspect.functions.length === 0) {
    return true;
  }
  if (isNil(frame.function)) {
    return false;
  }
  for (let index = 0; index < suspect.functions.length; index++) {
    const matchFuction = suspect.functions[index];
    const match =
      typeof matchFuction === 'string'
        ? frame.function === matchFuction
        : matchFuction.test(frame.function);
    if (match) {
      return true;
    }
  }
  return false;
}

function satisfiesOffendingThreadCondition(
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

  if (isNil(mappedState)) {
    return false;
  }
  return suspect.offendingThreadStates.includes(mappedState);
}

export function analyzeFramesForRootCause(event: Event): {
  culprit: string;
  resources: React.ReactNode;
} | null {
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

  for (let index = 0; index < exceptionFrames.length; index++) {
    const frame = exceptionFrames[index];
    for (let culpritIndex = 0; culpritIndex < CULPRIT_FRAMES.length; culpritIndex++) {
      const possibleCulprit = CULPRIT_FRAMES[culpritIndex];
      if (
        satisfiesModuleCondition(frame, possibleCulprit) &&
        satisfiesFunctionCondition(frame, possibleCulprit) &&
        satisfiesOffendingThreadCondition(currentThread?.state, possibleCulprit)
      ) {
        return {
          culprit:
            typeof possibleCulprit.module === 'string'
              ? possibleCulprit.module
              : possibleCulprit.module.toString(),
          resources: possibleCulprit.resources,
        };
      }
    }
  }

  return null;
}
