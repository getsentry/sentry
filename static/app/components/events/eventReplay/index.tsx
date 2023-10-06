import {useCallback} from 'react';

import ErrorBoundary from 'sentry/components/errorBoundary';
import {EventReplaySection} from 'sentry/components/events/eventReplay/eventReplaySection';
import LazyLoad from 'sentry/components/lazyLoad';
import {Group} from 'sentry/types';
import {Event} from 'sentry/types/event';
import {getAnalyticsDataForEvent, getAnalyticsDataForGroup} from 'sentry/utils/events';
import {getReplayIdFromEvent} from 'sentry/utils/replays/getReplayIdFromEvent';
import {useHasOrganizationSentAnyReplayEvents} from 'sentry/utils/replays/hooks/useReplayOnboarding';
import {projectCanLinkToReplay} from 'sentry/utils/replays/projectSupportsReplay';
import useOrganization from 'sentry/utils/useOrganization';
import useProjectFromSlug from 'sentry/utils/useProjectFromSlug';

type Props = {
  event: Event;
  projectSlug: string;
  group?: Group;
};

function EventReplayContent({event, group}: Props) {
  const organization = useOrganization();
  const {hasOrgSentReplays, fetching} = useHasOrganizationSentAnyReplayEvents();
  const replayId = getReplayIdFromEvent(event);

  const onboardingPanel = useCallback(() => import('./replayInlineOnboardingPanel'), []);
  const replayPreview = useCallback(() => import('./replayPreview'), []);

  if (fetching) {
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

  const startTimestampMS =
    'startTimestamp' in event ? event.startTimestamp * 1000 : undefined;
  const timeOfEvent = event.dateCreated ?? startTimestampMS ?? event.dateReceived;
  const eventTimestampMs = timeOfEvent ? Math.floor(new Date(timeOfEvent).getTime()) : 0;

  return (
    <EventReplaySection>
      <ErrorBoundary mini>
        <LazyLoad
          component={replayPreview}
          replaySlug={replayId}
          orgSlug={organization.slug}
          eventTimestampMs={eventTimestampMs}
          buttonProps={{
            analyticsEventKey: 'issue_details.open_replay_details_clicked',
            analyticsEventName: 'Issue Details: Open Replay Details Clicked',
            analyticsParams: {
              ...getAnalyticsDataForEvent(event),
              ...getAnalyticsDataForGroup(group),
              organization,
            },
          }}
        />
      </ErrorBoundary>
    </EventReplaySection>
  );
}

export default function EventReplay({projectSlug, event, group}: Props) {
  const organization = useOrganization();
  const hasReplaysFeature = organization.features.includes('session-replay');
  const project = useProjectFromSlug({organization, projectSlug});
  const isReplayRelated = projectCanLinkToReplay(project);

  if (!hasReplaysFeature || !isReplayRelated) {
    return null;
  }

  return <EventReplayContent {...{projectSlug, event, group}} />;
}
