import {useEffect} from 'react';
import * as Sentry from '@sentry/react';

interface Options {
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
}

/**
 * Force a session replay for a critical flow regardless of the global
 * sample rate, and tag it for later discovery.
 *
 * Why: getsentry runs at 5% session sample / 100% on-error sample. That's
 * the right default for the whole app, but for high-value funnels we want
 * every successful run too — not just the ones that errored.
 *
 * No-op when the Replay integration isn't registered (dev, self-hosted,
 * or before getsentry's lazy init has finished).
 */
export function useReplayForCriticalFlow({flowName, enabled = true}: Options) {
  useEffect(() => {
    if (!enabled) {
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
  }, [enabled, flowName]);
}
