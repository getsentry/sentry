import {useCallback} from 'react';

import ErrorBoundary from 'sentry/components/errorBoundary';
import LazyLoad from 'sentry/components/lazyLoad';
import {PlatformKey} from 'sentry/data/platformCategories';
import {Event} from 'sentry/types/event';
import {useHaveSelectedProjectsSentAnyReplayEvents} from 'sentry/utils/replays/hooks/useReplayOnboarding';
import projectSupportsReplay from 'sentry/utils/replays/projectSupportsReplay';

type Props = {
  event: Event;
  orgSlug: string;
  projectSlug: string;
  replayId: undefined | string;
};

export default function EventReplay({replayId, orgSlug, projectSlug, event}: Props) {
  const hasSentOneReplay = useHaveSelectedProjectsSentAnyReplayEvents();

  const onboardingPanel = useCallback(() => import('./replayInlineOnboardingPanel'), []);
  const replayPreview = useCallback(() => import('./replayPreview'), []);

  const supportsReplay = projectSupportsReplay({
    id: event.projectID,
    slug: event.projectSlug || '',
    platform: event.platform as PlatformKey,
  });

  if (!supportsReplay) {
    return null;
  }

  if (!hasSentOneReplay) {
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
