import {useEffect, useState} from 'react';
import * as Sentry from '@sentry/react';

interface UseReplayForCriticalFlowOptions {
  /**
   * Tag value applied to the replay (and other events) for this flow,
   * so it can be filtered later in the Replays product.
   */
  flowName: string;
  /**
   * Skip the effect entirely when false. Avoids forcing a replay for users
   * who aren't actually in the flow (e.g. wrong experiment cohort).
   */
  enabled?: boolean;
  /**
   * Probability [0, 1] that a given mount forces a full session replay.
   * Independent of the global session sample rate. Defaults to 1.0
   * (force every user in the flow).
   */
  sampleRate?: number;
}

/**
 * Force a session replay for a critical flow regardless of the global
 * sample rate, and tag it for later discovery.
 *
 * No-op when the Replay integration isn't registered (e.g. self-hosted,
 * dev, acceptance tests, or before lazy init has finished).
 */
export function useReplayForCriticalFlow({
  flowName,
  enabled = true,
  sampleRate = 1,
}: UseReplayForCriticalFlowOptions) {
  const [shouldForce] = useState(() => Math.random() < sampleRate);

  useEffect(() => {
    if (!enabled || !shouldForce) {
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
  }, [enabled, shouldForce, flowName]);
}
