import {useCallback} from 'react';

import ErrorBoundary from 'sentry/components/errorBoundary';
import LazyLoad from 'sentry/components/lazyLoad';
import {Group, Organization} from 'sentry/types';
import {Event} from 'sentry/types/event';
import {trackAnalytics} from 'sentry/utils/analytics';
import {getAnalyticsDataForEvent, getAnalyticsDataForGroup} from 'sentry/utils/events';
import {useHasOrganizationSentAnyReplayEvents} from 'sentry/utils/replays/hooks/useReplayOnboarding';
import {projectCanLinkToReplay} from 'sentry/utils/replays/projectSupportsReplay';
import useProjectFromSlug from 'sentry/utils/useProjectFromSlug';

type Props = {
  event: Event;
  organization: Organization;
  projectSlug: string;
  replayId: undefined | string;
  group?: Group;
};

export default function EventReplay({
  replayId,
  organization,
  projectSlug,
  event,
  group,
}: Props) {
  const hasReplaysFeature = organization.features.includes('session-replay');
  const {hasOrgSentReplays, fetching} = useHasOrganizationSentAnyReplayEvents();

  const onboardingPanel = useCallback(() => import('./replayInlineOnboardingPanel'), []);
  const replayPreview = useCallback(() => import('./replayPreview'), []);

  const project = useProjectFromSlug({organization, projectSlug});
  const isReplayRelated = projectCanLinkToReplay(project);

  if (!hasReplaysFeature || fetching || !isReplayRelated) {
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
        onClickOpenReplay={() => {
          trackAnalytics('issue_details.open_replay_details_clicked', {
            ...getAnalyticsDataForEvent(event),
            ...getAnalyticsDataForGroup(group),
            organization,
          });
        }}
      />
    </ErrorBoundary>
  );
}
