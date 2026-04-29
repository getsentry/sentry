import {useEffect, useState} from 'react';
import * as Sentry from '@sentry/react';

import type {UseReplayForCriticalFlowOptions} from 'sentry/utils/replays/useReplayForCriticalFlow';

/**
 * gsApp implementation of the OSS `useReplayForCriticalFlow` hook.
 * Registered via HookStore as `react-hook:use-replay-for-critical-flow`.
 *
 * getsentry runs Session Replay at 5% session sample / 100% on-error.
 * That's the right default for the whole app, but for high-value funnels
 * we want a representative slice of successful runs too, not just the
 * ones that errored.
 *
 * No-op when the Replay integration isn't registered (dev, acceptance
 * tests, or before getsentry's lazy init has finished).
 */
export function useReplayForCriticalFlow({
  flowName,
  enabled = true,
  sampleRate = 1,
}: UseReplayForCriticalFlowOptions) {
  // Decide once per mount so the effect is stable across re-renders.
  const [shouldForce] = useState(() => Math.random() < sampleRate);

  useEffect(() => {
    if (!enabled || !shouldForce) {
      return undefined;
    }

    const replay = Sentry.getReplay();
    if (!replay) {
      return undefined;
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
  }, [enabled, shouldForce, flowName]);
}
