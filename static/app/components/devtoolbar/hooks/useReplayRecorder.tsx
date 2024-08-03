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
  start(): boolean;
  stop(): boolean;
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

const POLL_INTERVAL_MS = 3000;
const LAST_REPLAY_STORAGE_KEY = 'devtoolbar.last_replay_id';

export default function useReplayRecorder(): ReplayRecorderState {
  // INTERNAL STATE
  const {SentrySDK} = useConfiguration();
  const replay =
    SentrySDK && 'getReplay' in SentrySDK ? SentrySDK.getReplay() : undefined;

  // sessionId is defined if we are recording in session OR buffer mode.
  const [sessionId, setSessionId] = useState<string | undefined>();
  const [recordingMode, setRecordingMode] = useState<ReplayRecordingMode | undefined>();
  // Polls periodically since a replay could be started by sessionSampleRate
  useEffect(() => {
    const intervalId = setInterval(() => {
      setSessionId(getSessionId(replay));
      setRecordingMode(getRecordingMode(replay));
    }, POLL_INTERVAL_MS);
    return () => clearInterval(intervalId);
  }, [replay]);

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
      sessionStorage.setItem(LAST_REPLAY_STORAGE_KEY, sessionId);
      setLastReplayId(sessionId);
    }
  }, [sessionId, recordingMode]);

  const start = () => {
    if (replay && !isRecording) {
      try {
        if (recordingMode === 'session') {
          replay.start();
        } else {
          replay.flush();
          // TODO: for 8.18, will this start a session replay?
        }
        return true;
        // eslint-disable-next-line no-empty
      } catch {}
    }
    return false;
  };

  const stop = () => {
    if (replay && isRecording) {
      try {
        replay.stop();
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
