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
   * Independent of getsentry's global session sample rate. Defaults to 1.0
   * (force every user in the flow).
   */
  sampleRate?: number;
}

function useNoopReplayForCriticalFlow(_options: UseReplayForCriticalFlowOptions) {}

/**
 * Force a session replay for a critical flow regardless of the global
 * sample rate, and tag it for later discovery.
 *
 * The implementation lives in getsentry (since OSS does not register the
 * Replay integration). When the gsApp hook is not registered, this is a
 * no-op, so self-hosted callers pay nothing.
 */
export function useReplayForCriticalFlow(options: UseReplayForCriticalFlowOptions) {
  const hook =
    HookStore.get('react-hook:use-replay-for-critical-flow')[0] ??
    useNoopReplayForCriticalFlow;
  hook(options);
}
