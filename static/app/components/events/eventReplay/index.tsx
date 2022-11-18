import {useCallback} from 'react';

import ErrorBoundary from 'sentry/components/errorBoundary';
import LazyLoad from 'sentry/components/lazyLoad';
import {Event} from 'sentry/types/event';
import useReplayOnboardingSidebarPanel from 'sentry/utils/replays/hooks/useReplayOnboardingSidebarPanel';

import ReplayOnboardingPanel from './replayOnboardingPanel';

type Props = {
  event: Event;
  orgSlug: string;
  projectSlug: string;
  replayId?: string;
};

export default function EventReplay({replayId, orgSlug, projectSlug, event}: Props) {
  const onboardingPanel = useReplayOnboardingSidebarPanel();
  const component = useCallback(() => import('./replayContent'), []);

  if (onboardingPanel.enabled) {
    return <ReplayOnboardingPanel {...onboardingPanel} />;
  }

  if (!replayId) {
    return null;
  }

  return (
    <ErrorBoundary mini>
      <LazyLoad
        component={component}
        replaySlug={`${projectSlug}:${replayId}`}
        orgSlug={orgSlug}
        event={event}
      />
    </ErrorBoundary>
  );
}
