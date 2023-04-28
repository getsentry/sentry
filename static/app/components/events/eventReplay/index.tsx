import {useCallback} from 'react';

import ErrorBoundary from 'sentry/components/errorBoundary';
import LazyLoad from 'sentry/components/lazyLoad';
import {Organization} from 'sentry/types';
import {Event} from 'sentry/types/event';
import {useHasOrganizationSentAnyReplayEvents} from 'sentry/utils/replays/hooks/useReplayOnboarding';

type Props = {
  event: Event;
  organization: Organization;
  projectSlug: string;
  replayId: undefined | string;
};

export default function EventReplay({replayId, organization, projectSlug, event}: Props) {
  const hasReplaysFeature = organization.features.includes('session-replay');
  const {hasOrgSentReplays, fetching} = useHasOrganizationSentAnyReplayEvents();

  const onboardingPanel = useCallback(() => import('./replayInlineOnboardingPanel'), []);
  const replayPreview = useCallback(() => import('./replayPreview'), []);

  if (!hasReplaysFeature || fetching) {
    return null;
  }

  if (!hasOrgSentReplays) {
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
