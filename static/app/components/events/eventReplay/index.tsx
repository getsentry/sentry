import {Fragment, useCallback} from 'react';
import ReactLazyLoad from 'react-lazyload';
import styled from '@emotion/styled';

import {LinkButton} from 'sentry/components/button';
import NegativeSpaceContainer from 'sentry/components/container/negativeSpaceContainer';
import ErrorBoundary from 'sentry/components/errorBoundary';
import {REPLAY_LOADING_HEIGHT} from 'sentry/components/events/eventReplay/constants';
import {EventReplaySection} from 'sentry/components/events/eventReplay/eventReplaySection';
import LazyLoad from 'sentry/components/lazyLoad';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import {ReplayGroupContextProvider} from 'sentry/components/replays/replayGroupContext';
import {replayBackendPlatforms} from 'sentry/data/platformCategories';
import {t, tct} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Group} from 'sentry/types';
import type {Event} from 'sentry/types/event';
import {getAnalyticsDataForEvent, getAnalyticsDataForGroup} from 'sentry/utils/events';
import useReplayCountForIssues from 'sentry/utils/replayCount/useReplayCountForIssues';
import {getReplayIdFromEvent} from 'sentry/utils/replays/getReplayIdFromEvent';
import {useHasOrganizationSentAnyReplayEvents} from 'sentry/utils/replays/hooks/useReplayOnboarding';
import {projectCanUpsellReplay} from 'sentry/utils/replays/projectSupportsReplay';
import useOrganization from 'sentry/utils/useOrganization';
import useProjectFromSlug from 'sentry/utils/useProjectFromSlug';
import useRouter from 'sentry/utils/useRouter';
import {normalizeUrl} from 'sentry/utils/withDomainRequired';

type Props = {
  event: Event;
  projectSlug: string;
  group?: Group;
};

export const CLIP_OFFSETS = {
  durationAfterMs: 5_000,
  durationBeforeMs: 5_000,
};

function EventReplayContent({
  event,
  group,
  replayId,
}: Props & {replayId: undefined | string}) {
  const organization = useOrganization();
  const {hasOrgSentReplays, fetching} = useHasOrganizationSentAnyReplayEvents();
  const router = useRouter();
  const {getReplayCountForIssue} = useReplayCountForIssues();

  const replayOnboardingPanel = useCallback(
    () => import('./replayInlineOnboardingPanel'),
    []
  );
  const replayPreview = useCallback(() => import('./replayPreview'), []);
  const replayClipPreview = useCallback(() => import('./replayClipPreview'), []);

  const hasReplayClipFeature = organization.features.includes(
    'issue-details-inline-replay-viewer'
  );

  if (fetching) {
    return null;
  }

  const platform = group?.project.platform ?? group?.platform ?? 'other';
  const projectId = group?.project.id ?? event.projectID ?? '';

  // frontend or backend platforms
  if (!hasOrgSentReplays || (!replayId && replayBackendPlatforms.includes(platform))) {
    return (
      <ErrorBoundary mini>
        <LazyLoad
          component={replayOnboardingPanel}
          platform={platform}
          projectId={projectId}
        />
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

  const commonProps = {
    analyticsContext: 'issue_details',
    replaySlug: replayId,
    orgSlug: organization.slug,
    eventTimestampMs,
    fullReplayButtonProps: {
      analyticsEventKey: 'issue_details.open_replay_details_clicked',
      analyticsEventName: 'Issue Details: Open Replay Details Clicked',
      analyticsParams: {
        ...getAnalyticsDataForEvent(event),
        ...getAnalyticsDataForGroup(group),
        organization,
      },
    },
    loadingFallback: (
      <StyledNegativeSpaceContainer testId="replay-loading-placeholder">
        <LoadingIndicator />
      </StyledNegativeSpaceContainer>
    ),
  };

  // don't try to construct the url if we don't have a group
  const eventIdFromRouter = router.params.eventId;
  const baseUrl = group
    ? eventIdFromRouter
      ? normalizeUrl(
          `/organizations/${organization.slug}/issues/${group.id}/events/${eventIdFromRouter}/`
        )
      : normalizeUrl(`/organizations/${organization.slug}/issues/${group.id}/`)
    : '';
  const replayUrl = baseUrl ? `${baseUrl}replays/${location.search}/` : '';
  const seeAllReplaysButton = replayUrl ? (
    <LinkButton size="sm" to={replayUrl}>
      {t('See All Replays')}
    </LinkButton>
  ) : undefined;
  const replayCount = group ? getReplayCountForIssue(group.id, group.issueCategory) : -1;
  const overlayContent =
    seeAllReplaysButton && replayCount && replayCount > 1 ? (
      <Fragment>
        <div>
          {tct('Replay captured [replayCount] users experiencing this issue', {
            replayCount,
          })}
        </div>
        {seeAllReplaysButton}
      </Fragment>
    ) : undefined;

  return (
    <ReplaySectionMinHeight actions={seeAllReplaysButton}>
      <ErrorBoundary mini>
        <ReplayGroupContextProvider groupId={group?.id} eventId={event.id}>
          <ReactLazyLoad debounce={50} height={448} offset={0} once>
            {hasReplayClipFeature ? (
              <LazyLoad
                {...commonProps}
                component={replayClipPreview}
                clipOffsets={CLIP_OFFSETS}
                overlayContent={overlayContent}
              />
            ) : (
              <LazyLoad {...commonProps} component={replayPreview} />
            )}
          </ReactLazyLoad>
        </ReplayGroupContextProvider>
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
  min-height: 557px;
`;

const StyledNegativeSpaceContainer = styled(NegativeSpaceContainer)`
  height: ${REPLAY_LOADING_HEIGHT}px;
  margin-bottom: ${space(2)};
`;
