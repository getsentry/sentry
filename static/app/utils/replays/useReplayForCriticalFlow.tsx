import {HookStore} from 'sentry/stores/hookStore';

export interface UseReplayForCriticalFlowOptions {
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

const noop = (_: UseReplayForCriticalFlowOptions) => {};

/**
 * Force a session replay for a critical flow regardless of the global
 * sample rate, and tag it for later discovery.
 *
 * Implementation lives in gsApp because forcing replays requires the
 * Replay integration, which is only registered there. Self-hosted falls
 * through to a noop.
 */
export function useReplayForCriticalFlow(options: UseReplayForCriticalFlowOptions) {
  const useImpl = HookStore.get('react-hook:use-replay-for-critical-flow')[0] ?? noop;
  useImpl(options);
}
