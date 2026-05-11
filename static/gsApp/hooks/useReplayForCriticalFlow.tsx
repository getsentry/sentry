import {useEffect, useMemo} from 'react';
import * as Sentry from '@sentry/react';

import type {UseReplayForCriticalFlowOptions} from 'sentry/utils/replays/useReplayForCriticalFlow';

import {useReplayReady} from 'getsentry/utils/useReplayInit';

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
  // Replay is registered at the App root (component:replay-init), but
  // registration is async (dynamic import of @sentry/react). On a fresh
  // load straight into a critical-flow route, this effect can fire before
  // the integration resolves; `ready` flips when it does so the effect
  // re-runs and `Sentry.getReplay()` returns non-null.
  const ready = useReplayReady();

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
