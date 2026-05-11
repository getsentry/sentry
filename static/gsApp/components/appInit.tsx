import {useReplayInit} from 'getsentry/utils/useReplayInit';

/**
 * App-level init for getsentry-only SDK integrations. Mounted via the
 * `component:app-init` hook at the App root so it runs above both
 * `OrganizationLayout` and `OrganizationContainerRoute` — meaning routes
 * like `/onboarding/*` (which only mount the latter) still get Replay
 * registered.
 */
export function AppInit() {
  useReplayInit();
  return null;
}
