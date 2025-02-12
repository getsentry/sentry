import {Fragment, lazy} from 'react';
import ReactLazyLoad from 'react-lazyload';
import styled from '@emotion/styled';

import {LinkButton} from 'sentry/components/button';
import NegativeSpaceContainer from 'sentry/components/container/negativeSpaceContainer';
import ErrorBoundary from 'sentry/components/errorBoundary';
import {REPLAY_LOADING_HEIGHT} from 'sentry/components/events/eventReplay/constants';
import LazyLoad from 'sentry/components/lazyLoad';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import {ReplayGroupContextProvider} from 'sentry/components/replays/replayGroupContext';
import {t, tn} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Event} from 'sentry/types/event';
import type {Group} from 'sentry/types/group';
import {getAnalyticsDataForEvent, getAnalyticsDataForGroup} from 'sentry/utils/events';
import useReplayCountForIssues from 'sentry/utils/replayCount/useReplayCountForIssues';
import useOrganization from 'sentry/utils/useOrganization';
import {SectionKey} from 'sentry/views/issueDetails/streamline/context';
import {InterimSection} from 'sentry/views/issueDetails/streamline/interimSection';
import {Tab, TabPaths} from 'sentry/views/issueDetails/types';
import {useGroupDetailsRoute} from 'sentry/views/issueDetails/useGroupDetailsRoute';
import {useHasStreamlinedUI} from 'sentry/views/issueDetails/utils';

interface Props {
  event: Event;
  group: Group | undefined;
  replayId: string;
}

const REPLAY_CLIP_OFFSETS = {
  durationAfterMs: 5_000,
  durationBeforeMs: 5_000,
};

const ReplayClipPreview = lazy(() => import('./replayClipPreview'));

export function ReplayClipSection({event, group, replayId}: Props) {
  const organization = useOrganization();
  const hasStreamlinedUI = useHasStreamlinedUI();
  const {getReplayCountForIssue} = useReplayCountForIssues();
  const {baseUrl} = useGroupDetailsRoute();

  const startTimestampMS =
    'startTimestamp' in event ? event.startTimestamp * 1000 : undefined;
  const timeOfEvent = event.dateCreated ?? startTimestampMS ?? event.dateReceived;
  const eventTimestampMs = timeOfEvent ? Math.floor(new Date(timeOfEvent).getTime()) : 0;

  const allReplaysButton = (
    <LinkButton
      size="xs"
      to={{
        pathname: `${baseUrl}${TabPaths[Tab.REPLAYS]}`,
      }}
      replace
      analyticsEventKey="issue_details.replay_player.clicked_see_all_replays"
      analyticsEventName="Issue Details: Replay Player Clicked See All Replays"
    >
      {t('See All Replays')}
    </LinkButton>
  );

  const replayCount = group ? getReplayCountForIssue(group.id, group.issueCategory) : -1;
  const overlayContent =
    replayCount && replayCount > 1 ? (
      <Fragment>
        <div>
          {replayCount > 50
            ? t('There are 50+ replays for this issue.')
            : tn(
                'There is %s replay for this issue.',
                'there are %s replays for this issue.',
                replayCount ?? 0
              )}
        </div>
        {allReplaysButton}
      </Fragment>
    ) : undefined;

  const lazyReplay = (
    <LazyLoad
      analyticsContext="issue_details"
      replaySlug={replayId}
      orgSlug={organization.slug}
      eventTimestampMs={eventTimestampMs}
      fullReplayButtonProps={{
        analyticsEventKey: 'issue_details.open_replay_details_clicked',
        analyticsEventName: 'Issue Details: Open Replay Details Clicked',
        analyticsParams: {
          ...getAnalyticsDataForEvent(event),
          ...getAnalyticsDataForGroup(group),
          organization,
        },
      }}
      loadingFallback={
        <StyledNegativeSpaceContainer data-test-id="replay-loading-placeholder">
          <LoadingIndicator />
        </StyledNegativeSpaceContainer>
      }
      LazyComponent={ReplayClipPreview}
      clipOffsets={REPLAY_CLIP_OFFSETS}
      overlayContent={overlayContent}
    />
  );

  return (
    <ReplaySectionMinHeight
      title={t('Session Replay')}
      actions={allReplaysButton}
      type={SectionKey.REPLAY}
    >
      <ErrorBoundary mini>
        <ReplayGroupContextProvider groupId={group?.id} eventId={event.id}>
          {hasStreamlinedUI ? (
            lazyReplay
          ) : (
            <ReactLazyLoad debounce={50} height={448} offset={0} once>
              {lazyReplay}
            </ReactLazyLoad>
          )}
        </ReplayGroupContextProvider>
      </ErrorBoundary>
    </ReplaySectionMinHeight>
  );
}

// The min-height here is due to max-height that is set in replayPreview.tsx
const ReplaySectionMinHeight = styled(InterimSection)`
  min-height: 557px;
`;

export const StyledNegativeSpaceContainer = styled(NegativeSpaceContainer)`
  height: ${REPLAY_LOADING_HEIGHT}px;
  margin-bottom: ${space(2)};
`;
