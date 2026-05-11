import {useEffect, useMemo} from 'react';
import * as Sentry from '@sentry/react';

import type {UseReplayForCriticalFlowOptions} from 'sentry/utils/replays/useReplayForCriticalFlow';

import {useReplayInit} from 'getsentry/utils/useReplayInit';

export function useReplayForCriticalFlow({
  flowName,
  enabled = true,
  sampleRate = 1,
}: UseReplayForCriticalFlowOptions) {
  const shouldForce = useMemo(
    () => Math.random() < sampleRate,
    // sampleRate is captured once on mount on purpose
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );
  // Replay is initialized at the App root (component:app-init), so this call
  // is normally a no-op singleton check. We still invoke it to obtain the
  // `ready` signal: App init runs an async dynamic import, so the integration
  // may not be registered yet on the first render of this hook's consumer.
  const ready = useReplayInit();

  useEffect(() => {
    if (!enabled || !shouldForce || !ready) {
      return;
    }

    const replay = Sentry.getReplay();
    if (!replay) {
      return;
    }

    Sentry.setTag('critical_flow', flowName);

    // flush() handles all three states per the SDK docstring:
    //   - not yet recording -> starts a session replay
    //   - buffer mode -> upgrades buffer to session
    //   - session mode -> queued no-op
    replay.flush();

    return () => {
      replay.flush();
      Sentry.setTag('critical_flow', undefined);
    };
  }, [enabled, shouldForce, flowName, ready]);
}
