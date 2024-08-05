import {useCallback, useEffect, useState} from 'react';
import type {replayIntegration} from '@sentry/react';
import type {ReplayRecordingMode} from '@sentry/types';

import useConfiguration from 'sentry/components/devtoolbar/hooks/useConfiguration';

type ReplayRecorderState = {
  disabledReason: string | undefined;
  isDisabled: boolean;
  isRecording: boolean;
  lastReplayId: string | undefined;
  start(): Promise<boolean>;
  stop(): Promise<boolean>;
};

function getIsRecording(
  replay: ReturnType<typeof replayIntegration> | undefined
): boolean {
  return replay?._replay.isEnabled() ?? false;
}

function getSessionId(
  replay: ReturnType<typeof replayIntegration> | undefined
): string | undefined {
  return replay?._replay.getSessionId();
}

function getRecordingMode(
  replay: ReturnType<typeof replayIntegration> | undefined
): ReplayRecordingMode | undefined {
  return replay?._replay.recordingMode;
}

const LAST_REPLAY_STORAGE_KEY = 'devtoolbar.last_replay_id';

export default function useReplayRecorder(): ReplayRecorderState {
  // INTERNAL STATE
  const {SentrySDK} = useConfiguration();
  const replay =
    SentrySDK && 'getReplay' in SentrySDK ? SentrySDK.getReplay() : undefined;

  // sessionId is defined if we are recording in session OR buffer mode.
  const [sessionId, setSessionId] = useState<string | undefined>(() =>
    getSessionId(replay)
  );
  const [recordingMode, setRecordingMode] = useState<ReplayRecordingMode | undefined>(
    () => getRecordingMode(replay)
  );

  // EXPORTED
  const isDisabled = replay === undefined; // TODO: should we also do FF checks?
  const disabledReason = !SentrySDK
    ? 'Failed to load the Sentry SDK.'
    : !('getReplay' in SentrySDK)
      ? 'Your SDK version is too outdated to access the Replay integration.'
      : !replay
        ? 'Failed to load the SDK Replay integration'
        : undefined;

  const [isRecording, setIsRecording] = useState<boolean>(false);
  const [lastReplayId, setLastReplayId] = useState<string | undefined>(
    sessionStorage.getItem(LAST_REPLAY_STORAGE_KEY) || undefined
  );
  useEffect(() => {
    if (isRecording && sessionId) {
      setLastReplayId(sessionId);
      sessionStorage.setItem(LAST_REPLAY_STORAGE_KEY, sessionId);
    }
  }, [isRecording, sessionId]);

  const refreshState = useCallback(() => {
    setIsRecording(getIsRecording(replay));
    setSessionId(getSessionId(replay));
    setRecordingMode(getRecordingMode(replay));
  }, [replay]);

  const start = useCallback(async () => {
    let success = false;
    if (replay && !isRecording) {
      try {
        if (recordingMode === 'session') {
          replay.start();
        } else {
          await replay.flush();
          // TODO: for 8.18, will this start a session replay?
        }
        success = true;
        // eslint-disable-next-line no-empty
      } catch {}
    }
    refreshState();
    return success;
  }, [isRecording, recordingMode, replay, refreshState]);

  const stop = useCallback(async () => {
    let success = false;
    if (replay && isRecording) {
      try {
        await replay.stop();
        success = true;
        // eslint-disable-next-line no-empty
      } catch {}
    }
    refreshState();
    return success;
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
