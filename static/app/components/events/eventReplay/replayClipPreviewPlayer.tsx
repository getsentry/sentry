import type {ComponentProps} from 'react';
import styled from '@emotion/styled';

import {Alert} from 'sentry/components/alert';
import type {LinkButton} from 'sentry/components/button';
import NegativeSpaceContainer from 'sentry/components/container/negativeSpaceContainer';
import {
  REPLAY_LOADING_HEIGHT,
  REPLAY_LOADING_HEIGHT_LARGE,
} from 'sentry/components/events/eventReplay/constants';
import ReplayPreviewPlayer from 'sentry/components/events/eventReplay/replayPreviewPlayer';
import {StaticReplayPreview} from 'sentry/components/events/eventReplay/staticReplayPreview';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import {Flex} from 'sentry/components/profiling/flex';
import MissingReplayAlert from 'sentry/components/replays/alerts/missingReplayAlert';
import ReplayProcessingError from 'sentry/components/replays/replayProcessingError';
import {IconDelete} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {TabKey} from 'sentry/utils/replays/hooks/useActiveReplayTab';
import type useReplayReader from 'sentry/utils/replays/hooks/useReplayReader';
import type RequestError from 'sentry/utils/requestError/requestError';
import useRouteAnalyticsParams from 'sentry/utils/routeAnalytics/useRouteAnalyticsParams';
import FluidHeight from 'sentry/views/replays/detail/layout/fluidHeight';
import type {ReplayRecord} from 'sentry/views/replays/types';

type Props = {
  analyticsContext: string;
  orgSlug: string;
  focusTab?: TabKey;
  fullReplayButtonProps?: Partial<ComponentProps<typeof LinkButton>>;
  handleBackClick?: () => void;
  handleForwardClick?: () => void;
  isLarge?: boolean;
  onClickNextReplay?: () => void;
  overlayText?: string;
  showNextAndPrevious?: boolean;
} & ReturnType<typeof useReplayReader>;

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
  overlayText,
  fetching,
  replay,
  replayRecord,
  fetchError,
  replayId,
  showNextAndPrevious,
  onClickNextReplay,
}: Props) {
  useRouteAnalyticsParams({
    event_replay_status: getReplayAnalyticsStatus({fetchError, replayRecord}),
  });

  if (replayRecord?.is_archived) {
    return (
      <Alert type="warning" data-test-id="replay-error">
        <Flex gap={space(0.5)}>
          <IconDelete color="gray500" size="sm" />
          {t('The replay for this event has been deleted.')}
        </Flex>
      </Alert>
    );
  }

  if (fetchError) {
    return <MissingReplayAlert orgSlug={orgSlug} />;
  }

  if (fetching || !replayRecord || !replay) {
    return (
      <StyledNegativeSpaceContainer testId="replay-loading-placeholder" isLarge={isLarge}>
        <LoadingIndicator />
      </StyledNegativeSpaceContainer>
    );
  }

  if (replay.getDurationMs() <= 0) {
    return (
      <StaticReplayPreview
        analyticsContext={analyticsContext}
        isFetching={false}
        replay={replay}
        replayId={replayId}
        fullReplayButtonProps={fullReplayButtonProps}
        initialTimeOffsetMs={0}
      />
    );
  }

  return (
    <PlayerContainer data-test-id="player-container" isLarge={isLarge}>
      {replay?.hasProcessingErrors() ? (
        <ReplayProcessingError processingErrors={replay.processingErrors()} />
      ) : (
        <ReplayPreviewPlayer
          replayId={replayId}
          fullReplayButtonProps={fullReplayButtonProps}
          replayRecord={replayRecord}
          handleBackClick={handleBackClick}
          handleForwardClick={handleForwardClick}
          overlayText={overlayText}
          showNextAndPrevious={showNextAndPrevious}
          onClickNextReplay={onClickNextReplay}
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
`;

const StyledNegativeSpaceContainer = styled(NegativeSpaceContainer)<{isLarge?: boolean}>`
  height: ${p => (p.isLarge ? REPLAY_LOADING_HEIGHT_LARGE : REPLAY_LOADING_HEIGHT)}px;
  margin-bottom: ${space(2)};
`;

export default ReplayClipPreviewPlayer;
