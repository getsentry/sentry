import {useEffect} from 'react';
import styled from '@emotion/styled';

import {Alert} from 'sentry/components/alert';
import type {LinkButtonProps} from 'sentry/components/button';
import {Flex} from 'sentry/components/container/flex';
import NegativeSpaceContainer from 'sentry/components/container/negativeSpaceContainer';
import {
  REPLAY_LOADING_HEIGHT,
  REPLAY_LOADING_HEIGHT_LARGE,
} from 'sentry/components/events/eventReplay/constants';
import ReplayPreviewPlayer from 'sentry/components/events/eventReplay/replayPreviewPlayer';
import {StaticReplayPreview} from 'sentry/components/events/eventReplay/staticReplayPreview';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import MissingReplayAlert from 'sentry/components/replays/alerts/missingReplayAlert';
import ReplayProcessingError from 'sentry/components/replays/replayProcessingError';
import {IconDelete} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {trackAnalytics} from 'sentry/utils/analytics';
import type {TabKey} from 'sentry/utils/replays/hooks/useActiveReplayTab';
import type useLoadReplayReader from 'sentry/utils/replays/hooks/useLoadReplayReader';
import type RequestError from 'sentry/utils/requestError/requestError';
import useRouteAnalyticsParams from 'sentry/utils/routeAnalytics/useRouteAnalyticsParams';
import useOrganization from 'sentry/utils/useOrganization';
import FluidHeight from 'sentry/views/replays/detail/layout/fluidHeight';
import type {ReplayRecord} from 'sentry/views/replays/types';

interface ReplayClipPreviewPlayerProps {
  analyticsContext: string;
  orgSlug: string;
  replayReaderResult: ReturnType<typeof useLoadReplayReader>;
  focusTab?: TabKey;
  fullReplayButtonProps?: Partial<Omit<LinkButtonProps, 'external'>>;
  handleBackClick?: () => void;
  handleForwardClick?: () => void;
  isLarge?: boolean;
  onClickNextReplay?: () => void;
  overlayContent?: React.ReactNode;
  showNextAndPrevious?: boolean;
}

function getReplayAnalyticsStatus({
  fetchError,
  replayRecord,
}: {
  fetchError?: RequestError;
  replayRecord?: ReplayRecord;
}) {
  if (fetchError) {
    return 'error';
  }

  if (replayRecord?.is_archived) {
    return 'archived';
  }

  if (replayRecord) {
    return 'success';
  }

  return 'none';
}
function ReplayClipPreviewPlayer({
  analyticsContext,
  orgSlug,
  fullReplayButtonProps,
  isLarge,
  handleForwardClick,
  handleBackClick,
  overlayContent,
  replayReaderResult,
  showNextAndPrevious,
}: ReplayClipPreviewPlayerProps) {
  useRouteAnalyticsParams({
    event_replay_status: getReplayAnalyticsStatus({
      fetchError: replayReaderResult.fetchError,
      replayRecord: replayReaderResult.replayRecord,
    }),
  });
  const organization = useOrganization();

  useEffect(() => {
    if (replayReaderResult.fetchError) {
      trackAnalytics('replay.render-missing-replay-alert', {
        organization,
        surface: 'issue details - clip preview',
      });
    }
  }, [organization, replayReaderResult.fetchError]);

  if (replayReaderResult.replayRecord?.is_archived) {
    return (
      <Alert type="warning" data-test-id="replay-error">
        <Flex gap={space(0.5)}>
          <IconDelete color="gray500" size="sm" />
          {t('The replay for this event has been deleted.')}
        </Flex>
      </Alert>
    );
  }

  if (replayReaderResult.fetchError) {
    return <MissingReplayAlert orgSlug={orgSlug} />;
  }

  if (
    replayReaderResult.fetching ||
    !replayReaderResult.replayRecord ||
    !replayReaderResult.replay
  ) {
    return (
      <StyledNegativeSpaceContainer
        data-test-id="replay-loading-placeholder"
        isLarge={isLarge}
      >
        <LoadingIndicator />
      </StyledNegativeSpaceContainer>
    );
  }

  if (replayReaderResult.replay.getDurationMs() <= 0) {
    return (
      <StaticReplayPreview
        analyticsContext={analyticsContext}
        isFetching={false}
        replay={replayReaderResult.replay}
        replayId={replayReaderResult.replayId}
        fullReplayButtonProps={fullReplayButtonProps}
        initialTimeOffsetMs={0}
      />
    );
  }

  return (
    <PlayerContainer data-test-id="player-container" isLarge={isLarge}>
      {replayReaderResult.replay?.hasProcessingErrors() ? (
        <ReplayProcessingError
          processingErrors={replayReaderResult.replay.processingErrors()}
        />
      ) : (
        <ReplayPreviewPlayer
          replayId={replayReaderResult.replayId}
          fullReplayButtonProps={fullReplayButtonProps}
          replayRecord={replayReaderResult.replayRecord}
          handleBackClick={handleBackClick}
          handleForwardClick={handleForwardClick}
          overlayContent={overlayContent}
          showNextAndPrevious={showNextAndPrevious}
          // if the player is large, we want to keep the priority as default
          playPausePriority={isLarge ? 'default' : undefined}
        />
      )}
    </PlayerContainer>
  );
}

const PlayerContainer = styled(FluidHeight)<{isLarge?: boolean}>`
  position: relative;
  max-height: ${p =>
    p.isLarge ? REPLAY_LOADING_HEIGHT_LARGE : REPLAY_LOADING_HEIGHT + 16}px;
  @media (min-width: ${p => p.theme.breakpoints.small}) {
    min-height: ${p =>
      p.isLarge ? REPLAY_LOADING_HEIGHT_LARGE : REPLAY_LOADING_HEIGHT + 16}px;
  }
`;

const StyledNegativeSpaceContainer = styled(NegativeSpaceContainer)<{isLarge?: boolean}>`
  height: ${p => (p.isLarge ? REPLAY_LOADING_HEIGHT_LARGE : REPLAY_LOADING_HEIGHT)}px;
  border-radius: ${p => p.theme.borderRadius};
`;

export default ReplayClipPreviewPlayer;
