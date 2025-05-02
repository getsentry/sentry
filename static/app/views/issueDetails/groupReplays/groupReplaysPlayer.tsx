import styled from '@emotion/styled';

import NegativeSpaceContainer from 'sentry/components/container/negativeSpaceContainer';
import {REPLAY_LOADING_HEIGHT_LARGE} from 'sentry/components/events/eventReplay/constants';
import ReplayPreviewPlayer from 'sentry/components/events/eventReplay/replayPreviewPlayer';
import {StaticReplayPreview} from 'sentry/components/events/eventReplay/staticReplayPreview';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import ArchivedReplayAlert from 'sentry/components/replays/alerts/archivedReplayAlert';
import ReplayLoadingState from 'sentry/components/replays/player/replayLoadingState';
import ReplayProcessingError from 'sentry/components/replays/replayProcessingError';
import {t} from 'sentry/locale';
import type useLoadReplayReader from 'sentry/utils/replays/hooks/useLoadReplayReader';
import useLogEventReplayStatus from 'sentry/utils/replays/hooks/useLogEventReplayStatus';
import FluidHeight from 'sentry/views/replays/detail/layout/fluidHeight';

interface Props {
  analyticsContext: string;
  handleBackClick: undefined | (() => void);
  handleForwardClick: undefined | (() => void);
  overlayContent: React.ReactNode;
  replayReaderResult: ReturnType<typeof useLoadReplayReader>;
}

export default function GroupReplaysPlayer({
  analyticsContext,
  handleForwardClick,
  handleBackClick,
  overlayContent,
  replayReaderResult,
}: Props) {
  useLogEventReplayStatus({
    readerResult: replayReaderResult,
  });

  return (
    <ReplayLoadingState
      readerResult={replayReaderResult}
      renderArchived={() => (
        <ArchivedReplayAlert message={t('The replay for this event has been deleted.')} />
      )}
      renderLoading={() => (
        <StyledNegativeSpaceContainer data-test-id="replay-loading-placeholder">
          <LoadingIndicator />
        </StyledNegativeSpaceContainer>
      )}
    >
      {({replay}) => {
        if (replay.getDurationMs() <= 0) {
          return (
            <StaticReplayPreview
              analyticsContext={analyticsContext}
              isFetching={false}
              replay={replay}
              replayId={replayReaderResult.replayId}
              initialTimeOffsetMs={0}
            />
          );
        }

        return (
          <PlayerContainer data-test-id="player-container">
            {replay?.hasProcessingErrors() ? (
              <ReplayProcessingError processingErrors={replay.processingErrors()} />
            ) : (
              <ReplayPreviewPlayer
                errorBeforeReplayStart={replay.getErrorBeforeReplayStart()}
                replayId={replayReaderResult.replayId}
                replayRecord={replayReaderResult.replayRecord!}
                handleBackClick={handleBackClick}
                handleForwardClick={handleForwardClick}
                overlayContent={overlayContent}
                showNextAndPrevious
                playPausePriority="default"
              />
            )}
          </PlayerContainer>
        );
      }}
    </ReplayLoadingState>
  );
}

const PlayerContainer = styled(FluidHeight)`
  position: relative;
  max-height: ${REPLAY_LOADING_HEIGHT_LARGE}px;
  @media (min-width: ${p => p.theme.breakpoints.small}) {
    min-height: ${REPLAY_LOADING_HEIGHT_LARGE}px;
  }
`;

const StyledNegativeSpaceContainer = styled(NegativeSpaceContainer)`
  height: ${REPLAY_LOADING_HEIGHT_LARGE}px;
  border-radius: ${p => p.theme.borderRadius};
`;
