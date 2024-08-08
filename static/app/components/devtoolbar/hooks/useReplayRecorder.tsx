import {useCallback, useEffect, useState} from 'react';
import type {replayIntegration} from '@sentry/react';
import type {ReplayRecordingMode} from '@sentry/types';

import useConfiguration from 'sentry/components/devtoolbar/hooks/useConfiguration';
import {useSessionStorage} from 'sentry/utils/useSessionStorage';

type ReplayRecorderState = {
  disabledReason: string | undefined;
  isDisabled: boolean;
  isRecording: boolean;
  lastReplayId: string | undefined;
  start(): Promise<boolean>;
  stop(): Promise<boolean>;
};

interface ReplayInternalAPI {
  [other: string]: any;
  getSessionId(): string | undefined;
  isEnabled(): boolean;
  recordingMode: ReplayRecordingMode;
}

function getReplayInternal(
  replay: ReturnType<typeof replayIntegration>
): ReplayInternalAPI {
  // While the toolbar is internal, we can use the private API for added functionality and reduced dependence on SDK release versions
  // @ts-ignore:next-line
  return replay._replay;
}

const LAST_REPLAY_STORAGE_KEY = 'devtoolbar.last_replay_id';

export default function useReplayRecorder(): ReplayRecorderState {
  const {SentrySDK} = useConfiguration();
  const replay =
    SentrySDK && 'getReplay' in SentrySDK ? SentrySDK.getReplay() : undefined;
  const replayInternal = replay ? getReplayInternal(replay) : undefined;

  // sessionId is defined if we are recording in session OR buffer mode.
  const [sessionId, setSessionId] = useState<string | undefined>(() =>
    replayInternal?.getSessionId()
  );
  const [recordingMode, setRecordingMode] = useState<ReplayRecordingMode | undefined>(
    () => replayInternal?.recordingMode
  );

  const isDisabled = replay === undefined;
  const disabledReason = !SentrySDK
    ? 'Failed to load the Sentry SDK.'
    : !('getReplay' in SentrySDK)
      ? 'Your SDK version is too old to support Replays.'
      : !replay
        ? 'You need to install the SDK Replay integration.'
        : undefined;

  const [isRecording, setIsRecording] = useState<boolean>(
    () => replayInternal?.isEnabled() ?? false
  );
  const [lastReplayId, setLastReplayId] = useSessionStorage<string | undefined>(
    LAST_REPLAY_STORAGE_KEY,
    undefined
  );
  useEffect(() => {
    if (isRecording && sessionId) {
      setLastReplayId(sessionId);
    }
  }, [isRecording, sessionId, setLastReplayId]);

  const refreshState = useCallback(() => {
    setIsRecording(replayInternal?.isEnabled() ?? false);
    setSessionId(replayInternal?.getSessionId());
    setRecordingMode(replayInternal?.recordingMode);
  }, [replayInternal]);

  const start = useCallback(async () => {
    let success = false;
    try {
      // SDK v8.19.0 and older will throw if a replay is already started.
      // Details at https://github.com/getsentry/sentry-javascript/pull/13000
      if (replay && !isRecording) {
        if (recordingMode === 'session') {
          replay.start();
        } else {
          // For SDK v8.20.0 and up, flush() works for both cases.
          await replay.flush();
        }
        success = true;
      }
      // eslint-disable-next-line no-empty
    } catch {
    } finally {
      refreshState();
      return success;
    }
  }, [isRecording, recordingMode, replay, refreshState]);

  const stop = useCallback(async () => {
    let success = false;
    try {
      if (replay && isRecording) {
        await replay.stop();
        success = true;
      }
      // eslint-disable-next-line no-empty
    } catch {
    } finally {
      refreshState();
      return success;
    }
  }, [isRecording, replay, refreshState]);

  return {
    disabledReason,
    isDisabled,
    isRecording,
    lastReplayId,
    start,
    stop,
  };
}
