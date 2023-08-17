import styled from '@emotion/styled';
import isNil from 'lodash/isNil';

import {
  getMappedThreadState,
  ThreadStates,
} from 'sentry/components/events/interfaces/threads/threadSelector/threadStates';
import {getCurrentThread} from 'sentry/components/events/interfaces/utils';
import ExternalLink from 'sentry/components/links/externalLink';
import {t, tct} from 'sentry/locale';
import {EntryException, EntryType, Event, Frame, Lock, Thread} from 'sentry/types';
import {defined} from 'sentry/utils';

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
    functions: [
      'read',
      'write',
      'fstat',
      'fsync',
      'fdatasync',
      'access',
      'open',
      'chmod',
    ],
    offendingThreadStates: [
      ThreadStates.WAITING,
      ThreadStates.TIMED_WAITING,
      ThreadStates.RUNNABLE,
    ],
    resources: t(
      'File I/O operations, such as reading from or writing to files on disk, can be time-consuming, especially if the file size is large or the storage medium is slow. Move File I/O off the main thread to avoid this ANR.'
    ),
  },
  {
    module: 'android.database.sqlite.SQLiteConnection',
    functions: [
      'nativeOpen',
      'nativeExecute',
      /nativeExecuteFor[a-zA-Z]+/,
      /nativeBind[a-zA-Z]+/,
      /nativeGet[a-zA-Z]+/,
      'nativePrepareStatement',
    ],
    offendingThreadStates: [
      ThreadStates.WAITING,
      ThreadStates.TIMED_WAITING,
      ThreadStates.RUNNABLE,
    ],
    resources: t(
      'Database operations, such as querying, inserting, updating, or deleting data, can involve disk I/O, processing, and potentially long-running operations. Move database operations off the main thread to avoid this ANR.'
    ),
  },
  {
    module: 'android.app.SharedPreferencesImpl$EditorImpl',
    functions: ['commit'],
    offendingThreadStates: [
      ThreadStates.WAITING,
      ThreadStates.TIMED_WAITING,
      ThreadStates.RUNNABLE,
    ],
    resources: t(
      "If you have a particularly large or complex SharedPreferences file or if you're performing multiple simultaneous commits in quick succession, this can lead to ANR. Switch to SharedPreferences.apply or move commit to a background thread to avoid this ANR."
    ),
  },
  {
    module: /^android\.app\.SharedPreferencesImpl\$EditorImpl\$[0-9]/,
    functions: ['run'],
    offendingThreadStates: [
      ThreadStates.WAITING,
      ThreadStates.TIMED_WAITING,
      ThreadStates.RUNNABLE,
    ],
    resources: t(
      'SharedPreferences.apply will save data on background thread only if it happens before the activity/service finishes. Switch to SharedPreferences.commit and move commit to a background thread.'
    ),
  },
  {
    module: 'android.app.Instrumentation',
    functions: ['callApplicationOnCreate'],
    offendingThreadStates: [
      ThreadStates.WAITING,
      ThreadStates.TIMED_WAITING,
      ThreadStates.RUNNABLE,
    ],
    resources: tct(
      'The app is initializing too many things on the main thread during app launch. To avoid this ANR, optimize cold/warm app starts by offloading operations off the main thread and [link:lazily initializing] components.',
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
    resources: t(
      'If the AssetManager operation involves reading or loading a large asset file on the main thread, this can lead to ANR. Move loading heavy assets off the main thread to avoid this ANR.'
    ),
  },
  {
    module: 'android.content.res.AssetManager',
    functions: [/^nativeGetResource[a-zA-Z]+/],
    offendingThreadStates: [
      ThreadStates.WAITING,
      ThreadStates.TIMED_WAITING,
      ThreadStates.RUNNABLE,
    ],
    resources: t(
      "If you're reading a particularly large raw file (for example, a video file) on the main thread, this can lead to ANR. Look for heavy resources in the '/res' or '/res/raw; folders to avoid this ANR."
    ),
  },
  {
    module: 'android.view.LayoutInflater',
    functions: ['inflate'],
    offendingThreadStates: [
      ThreadStates.WAITING,
      ThreadStates.TIMED_WAITING,
      ThreadStates.RUNNABLE,
    ],
    resources: tct(
      'The app is potentially inflating a heavy, deeply-nested layout. [link:Optimize view hierarchy], use view stubs, use include/merge tags for reusing inflated views to avoid this ANR.',
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
  offendingThreadStates?: ThreadStates[]
) {
  if (isNil(offendingThreadStates) || offendingThreadStates.length === 0) {
    return true;
  }
  const mappedState = getMappedThreadState(threadState);

  if (isNil(mappedState)) {
    return false;
  }
  return offendingThreadStates.includes(mappedState);
}

export function analyzeFramesForRootCause(event: Event): {
  culprit: string | Lock;
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

  const currentThread = getCurrentThread(event);

  // iterating the frames in reverse order, because the topmost frames most like the root cause
  for (let index = exceptionFrames.length - 1; index >= 0; index--) {
    const frame = exceptionFrames[index];
    const rootCause = analyzeFrameForRootCause(frame, currentThread);
    if (defined(rootCause)) {
      return rootCause;
    }
  }

  return null;
}

function lockRootCauseCulprit(lock: Lock): {
  culprit: string | Lock;
  resources: React.ReactNode;
} {
  const address = lock.address;
  const obj = `${lock.package_name}.${lock.class_name}`;
  const tid = lock.thread_id;
  return {
    culprit: lock,
    resources: tct(
      'The main thread is blocked/waiting, trying to acquire lock [address] ([obj]) [heldByThread]',
      {
        address: <Bold>{address}</Bold>,
        obj: <Bold>{obj}</Bold>,
        heldByThread: tid ? 'held by the suspect frame of this thread.' : '.',
      }
    ),
  };
}

export function analyzeFrameForRootCause(
  frame: Frame,
  currentThread?: Thread,
  lockAddress?: string
): {
  culprit: string | Lock;
  resources: React.ReactNode;
} | null {
  if (defined(lockAddress) && frame.lock?.address === lockAddress) {
    // if we are provided with a lockAddress, we just have to analyze if the frame's lock
    // address is equal to the one provided to mark the frame as suspect
    return lockRootCauseCulprit(frame.lock);
  }
  if (
    defined(frame.lock) &&
    currentThread?.current &&
    satisfiesOffendingThreadCondition(currentThread?.state, [
      ThreadStates.WAITING,
      ThreadStates.TIMED_WAITING,
      ThreadStates.BLOCKED,
    ])
  ) {
    // if the current (main) thread contains a lock and not in a RUNNABLE state, we return early
    // with the lock being the culprit
    return lockRootCauseCulprit(frame.lock);
  }
  // otherwise, we analyze for common patterns
  for (const possibleCulprit of CULPRIT_FRAMES) {
    if (
      satisfiesModuleCondition(frame, possibleCulprit) &&
      satisfiesFunctionCondition(frame, possibleCulprit) &&
      satisfiesOffendingThreadCondition(
        currentThread?.state,
        possibleCulprit.offendingThreadStates
      )
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
  return null;
}

const Bold = styled('span')`
  font-weight: bold;
`;
