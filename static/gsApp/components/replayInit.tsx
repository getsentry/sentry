import {useReplayInit} from 'getsentry/utils/useReplayInit';

/**
 * Drives Sentry Replay registration at the App root via the
 * `component:replay-init` hook. Mounting here (rather than under
 * `OrganizationLayout`) makes registration cover non-org routes like
 * `/onboarding/*`.
 */
export function ReplayInit() {
  useReplayInit();
  return null;
}
