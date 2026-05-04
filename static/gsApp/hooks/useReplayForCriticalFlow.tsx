import {useEffect, useState} from 'react';
import * as Sentry from '@sentry/react';

import type {UseReplayForCriticalFlowOptions} from 'sentry/utils/replays/useReplayForCriticalFlow';

import {useReplayInit} from 'getsentry/utils/useReplayInit';

export function useReplayForCriticalFlow({
  flowName,
  enabled = true,
  sampleRate = 1,
}: UseReplayForCriticalFlowOptions) {
  const [shouldForce] = useState(() => Math.random() < sampleRate);
  // The Replay integration is normally registered by OrganizationHeader,
  // which doesn't mount during /onboarding/* (those routes use
  // OrganizationContainerRoute, not OrganizationLayout). Calling it here
  // covers that gap; the singleton ref inside useReplayInit makes the
  // OrganizationHeader call a no-op later in the session.
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
