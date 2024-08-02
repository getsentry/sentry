import {createContext, useContext, useEffect, useState} from 'react';
import type SentrySDK from '@sentry/react'; // TODO: change to `@sentry/browser` when we have our own package.json
import type {replayIntegration} from '@sentry/react';
import type {ReplayRecordingMode} from '@sentry/types';

import type {ReplayRecordingContext} from '../types';

const context = createContext<ReplayRecordingContext>({
  currReplayId: undefined,
  lastReplayId: undefined,
  disabledReason: 'No replay context provider',
  isDisabled: true,
  isRecording: false,
  start: () => false,
  stop: () => false,
});

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

export function ReplayContextProvider({
  children,
  poll_interval_ms,
  sentrySdk,
}: {
  children: React.ReactNode;
  poll_interval_ms: number;
  sentrySdk: typeof SentrySDK | undefined;
}) {
  // INTERNAL STATE
  const replay =
    sentrySdk && 'getReplay' in sentrySdk ? sentrySdk.getReplay() : undefined;

  // sessionId is defined if we are recording in session OR buffer mode.
  const [sessionId, setSessionId] = useState<string | undefined>(getSessionId(replay));
  const [recordingMode, setRecordingMode] = useState<ReplayRecordingMode | undefined>(
    getRecordingMode(replay)
  );
  // Polls periodically since a replay could be started by sessionSampleRate
  useEffect(() => {
    const intervalId = setInterval(() => {
      setSessionId(getSessionId(replay));
      setRecordingMode(getRecordingMode(replay));
    }, poll_interval_ms);
    return () => clearInterval(intervalId);
  }, [replay, poll_interval_ms]);

  // EXPORTED
  const isDisabled = replay === undefined; // TODO: should we also do FF checks?
  const disabledReason = !sentrySdk
    ? 'Failed to load the Sentry SDK.'
    : !('getReplay' in sentrySdk)
      ? 'Your SDK version is too outdated to access the Replay integration.'
      : !replay
        ? 'Failed to load the SDK Replay integration'
        : undefined;

  const [isRecording, setIsRecording] = useState<boolean>(
    sessionId !== undefined && recordingMode === 'session'
  );
  const [currReplayId, setCurrReplayId] = useState<string | undefined>(
    isRecording ? sessionId : undefined
  );
  const [lastReplayId, setLastReplayId] = useState<string | undefined>(
    isRecording ? sessionId : undefined
  );
  useEffect(() => {
    const newIsRecording = sessionId !== undefined && recordingMode === 'session';
    setIsRecording(newIsRecording);
    setCurrReplayId(newIsRecording ? sessionId : undefined);
    if (newIsRecording) {
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

  return (
    <context.Provider
      value={{
        currReplayId,
        disabledReason,
        isDisabled,
        isRecording,
        lastReplayId,
        start,
        stop,
      }}
    >
      {children}
    </context.Provider>
  );
}

export default function useReplayContext() {
  return useContext(context);
}
