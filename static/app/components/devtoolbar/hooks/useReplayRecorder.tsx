import {useCallback, useEffect, useState} from 'react';
import type {ReplayRecordingMode} from '@sentry/core';
import type {replayIntegration} from '@sentry/react';

import useConfiguration from 'sentry/components/devtoolbar/hooks/useConfiguration';
import {useSessionStorage} from 'sentry/utils/useSessionStorage';

type ReplayRecorderState = {
  disabledReason: string | undefined;
  isDisabled: boolean;
  isRecording: boolean;
  lastReplayId: string | undefined;
  recordingMode: ReplayRecordingMode | undefined;
  startRecordingSession(): Promise<boolean>; // returns false if called in the wrong state
  stopRecording(): Promise<boolean>; // returns false if called in the wrong state
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
    if (isRecording && recordingMode === 'session' && sessionId) {
      setLastReplayId(sessionId);
    }
  }, [isRecording, recordingMode, sessionId, setLastReplayId]);

  const refreshState = useCallback(() => {
    setIsRecording(replayInternal?.isEnabled() ?? false);
    setSessionId(replayInternal?.getSessionId());
    setRecordingMode(replayInternal?.recordingMode);
  }, [replayInternal]);

  const startRecordingSession = useCallback(async () => {
    let success = false;
    if (replay) {
      // Note SDK v8.19 and older will throw if a replay is already started.
      // Details at https://github.com/getsentry/sentry-javascript/pull/13000
      if (!isRecording) {
        replay.start();
        success = true;
      } else if (recordingMode === 'buffer') {
        // For SDK v8.20+, flush() would work for both cases, but we're staying version-agnostic.
        await replay.flush();
        success = true;
      }
      refreshState();
    }
    return success;
  }, [replay, isRecording, recordingMode, refreshState]);

  const stopRecording = useCallback(async () => {
    let success = false;
    if (replay && isRecording) {
      await replay.stop();
      success = true;
      refreshState();
    }
    return success;
  }, [isRecording, replay, refreshState]);

  return {
    disabledReason,
    isDisabled,
    isRecording,
    lastReplayId,
    recordingMode,
    startRecordingSession,
    stopRecording,
  };
}
