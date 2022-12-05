import {useCallback} from 'react';

import ErrorBoundary from 'sentry/components/errorBoundary';
import LazyLoad from 'sentry/components/lazyLoad';
import {Event} from 'sentry/types/event';
import {useShouldShowOnboarding} from 'sentry/utils/replays/hooks/useReplayOnboarding';

type Props = {
  event: Event;
  orgSlug: string;
  projectSlug: string;
  replayId: undefined | string;
};

export default function EventReplay({replayId, orgSlug, projectSlug, event}: Props) {
  const showPanel = useShouldShowOnboarding();
  const onboardingPanel = useCallback(() => import('./replayInlineOnboardingPanel'), []);
  const replayPreview = useCallback(() => import('./replayPreview'), []);

  if (showPanel) {
    return (
      <ErrorBoundary mini>
        <LazyLoad component={onboardingPanel} />
      </ErrorBoundary>
    );
  }

  if (!replayId) {
    return null;
  }

  return (
    <ErrorBoundary mini>
      <LazyLoad
        component={replayPreview}
        replaySlug={`${projectSlug}:${replayId}`}
        orgSlug={orgSlug}
        event={event}
      />
    </ErrorBoundary>
  );
}
