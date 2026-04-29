import {useReplayForCriticalFlow} from 'getsentry/utils/replays/useReplayForCriticalFlow';

/**
 * Hook component rendered by the OSS new-org onboarding flow when the user
 * is in the SCM onboarding cohort. Forces a session replay for ~30% of
 * those users so we get representative funnel coverage beyond the global
 * 5% session sample / 100% on-error sample.
 */
export function ScmFlowReplayTracker() {
  useReplayForCriticalFlow({
    flowName: 'scm_onboarding',
    sampleRate: 0.3,
  });
  return null;
}
