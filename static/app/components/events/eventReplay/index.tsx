import {useCallback} from 'react';

import ErrorBoundary from 'sentry/components/errorBoundary';
import LazyLoad from 'sentry/components/lazyLoad';
import {PlatformKey} from 'sentry/data/platformCategories';
import {Organization} from 'sentry/types';
import {Event} from 'sentry/types/event';
import {useHaveSelectedProjectsSentAnyReplayEvents} from 'sentry/utils/replays/hooks/useReplayOnboarding';
import projectSupportsReplay from 'sentry/utils/replays/projectSupportsReplay';

type Props = {
  event: Event;
  organization: Organization;
  projectSlug: string;
  replayId: undefined | string;
};

export default function EventReplay({replayId, organization, projectSlug, event}: Props) {
  const hasReplaysFeature = organization.features.includes('session-replay');
  const {hasSentOneReplay, fetching} = useHaveSelectedProjectsSentAnyReplayEvents();

  const onboardingPanel = useCallback(() => import('./replayInlineOnboardingPanel'), []);
  const replayPreview = useCallback(() => import('./replayPreview'), []);

  const supportsReplay = projectSupportsReplay({
    id: event.projectID,
    slug: event.projectSlug || '',
    platform: event.platform as PlatformKey,
  });

  if (!hasReplaysFeature || fetching || !supportsReplay) {
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
        orgSlug={organization.slug}
        event={event}
      />
    </ErrorBoundary>
  );
}
