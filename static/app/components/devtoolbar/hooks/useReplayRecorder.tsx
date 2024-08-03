import {useEffect, useState} from 'react';
import type {replayIntegration} from '@sentry/react';
import type {ReplayRecordingMode} from '@sentry/types';

import useConfiguration from 'sentry/components/devtoolbar/hooks/useConfiguration';

type ReplayRecorderState = {
  currReplayId: string | undefined;
  disabledReason: string | undefined;
  isDisabled: boolean;
  isRecording: boolean;
  lastReplayId: string | undefined;
  start(): Promise<boolean>;
  stop(): Promise<boolean>;
};

function getSessionId(
  replay: ReturnType<typeof replayIntegration> | undefined
): string | undefined {
  try {
    return replay?.getReplayId();
  } catch {
    // TODO: catch a more specific error
    return undefined;
  }
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
  const [currReplayId, setCurrReplayId] = useState<string | undefined>();
  const [lastReplayId, setLastReplayId] = useState<string | undefined>(
    sessionStorage.getItem(LAST_REPLAY_STORAGE_KEY) || undefined
  );
  useEffect(() => {
    const newIsRecording = sessionId !== undefined && recordingMode === 'session';
    setIsRecording(newIsRecording);
    setCurrReplayId(newIsRecording ? sessionId : undefined);
    if (newIsRecording) {
      setLastReplayId(sessionId);
      sessionStorage.setItem(LAST_REPLAY_STORAGE_KEY, sessionId);
    }
  }, [sessionId, recordingMode]);

  const start = async () => {
    if (replay && !isRecording) {
      try {
        if (recordingMode === 'session') {
          replay.start();
        } else {
          await replay.flush();
          // TODO: for 8.18, will this start a session replay?
        }
        setSessionId(getSessionId(replay));
        setRecordingMode(getRecordingMode(replay));
        return true;
        // eslint-disable-next-line no-empty
      } catch {}
    }
    return false;
  };

  const stop = async () => {
    if (replay && isRecording) {
      try {
        await replay.stop();
        setSessionId(getSessionId(replay));
        setRecordingMode(getRecordingMode(replay));
        return true;
        // eslint-disable-next-line no-empty
      } catch {}
    }
    return false;
  };

  return {
    currReplayId,
    disabledReason,
    isDisabled,
    isRecording,
    lastReplayId,
    start,
    stop,
  };
}
