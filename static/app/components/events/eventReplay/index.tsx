import {useCallback} from 'react';
import ReactLazyLoad from 'react-lazyload';
import styled from '@emotion/styled';

import ErrorBoundary from 'sentry/components/errorBoundary';
import {EventReplaySection} from 'sentry/components/events/eventReplay/eventReplaySection';
import LazyLoad from 'sentry/components/lazyLoad';
import {Group} from 'sentry/types';
import {Event} from 'sentry/types/event';
import {getAnalyticsDataForEvent, getAnalyticsDataForGroup} from 'sentry/utils/events';
import {getReplayIdFromEvent} from 'sentry/utils/replays/getReplayIdFromEvent';
import {useHasOrganizationSentAnyReplayEvents} from 'sentry/utils/replays/hooks/useReplayOnboarding';
import {projectCanUpsellReplay} from 'sentry/utils/replays/projectSupportsReplay';
import useOrganization from 'sentry/utils/useOrganization';
import useProjectFromSlug from 'sentry/utils/useProjectFromSlug';

type Props = {
  event: Event;
  projectSlug: string;
  group?: Group;
};

function EventReplayContent({
  event,
  group,
  replayId,
}: Props & {replayId: undefined | string}) {
  const organization = useOrganization();
  const {hasOrgSentReplays, fetching} = useHasOrganizationSentAnyReplayEvents();

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
    <ReplaySectionMinHeight>
      <ErrorBoundary mini>
        <ReactLazyLoad debounce={50} height={448} offset={0} once>
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
        </ReactLazyLoad>
      </ErrorBoundary>
    </ReplaySectionMinHeight>
  );
}

export default function EventReplay({event, group, projectSlug}: Props) {
  const organization = useOrganization();
  const hasReplaysFeature = organization.features.includes('session-replay');

  const project = useProjectFromSlug({organization, projectSlug});
  const canUpsellReplay = projectCanUpsellReplay(project);
  const replayId = getReplayIdFromEvent(event);

  if (hasReplaysFeature && (replayId || canUpsellReplay)) {
    return (
      <EventReplayContent
        event={event}
        group={group}
        projectSlug={projectSlug}
        replayId={replayId}
      />
    );
  }

  return null;
}

// The min-height here is due to max-height that is set in replayPreview.tsx
const ReplaySectionMinHeight = styled(EventReplaySection)`
  min-height: 508px;
`;
