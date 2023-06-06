import {useCallback} from 'react';

import ErrorBoundary from 'sentry/components/errorBoundary';
import LazyLoad from 'sentry/components/lazyLoad';
import type {Event, Group, Organization, Project} from 'sentry/types';

interface Props {
  event: Event;
  group: Group;
  organization: Organization;
  project: Project;
}

function ReplayIssueLoader({event, organization}: Props) {
  const replayPreview = useCallback(
    () => import('sentry/components/events/eventReplay/replayPreview'),
    []
  );

  const hasReplay = organization.features?.includes('session-replay');
  const hasIssueDetailsReplayEvent = organization.features?.includes(
    'issue-details-replay-event'
  );
  if (!hasReplay || !hasIssueDetailsReplayEvent) {
    return null;
  }

  const replayId = event.tags.find(({key}) => key === 'replayId')?.value;
  if (!replayId) {
    return null;
  }

  return (
    <ErrorBoundary mini>
      <LazyLoad
        component={replayPreview}
        event={event}
        orgSlug={organization.slug}
        replaySlug={replayId}
      />
    </ErrorBoundary>
  );
}

export default ReplayIssueLoader;
