import styled from '@emotion/styled';
import type {Query} from 'history';

import {Alert} from '@sentry/scraps/alert';
import {Button} from '@sentry/scraps/button';

import {NegativeSpaceContainer} from 'sentry/components/container/negativeSpaceContainer';
import {REPLAY_LOADING_HEIGHT_LARGE} from 'sentry/components/events/eventReplay/constants';
import {ReplayPreviewPlayer} from 'sentry/components/events/eventReplay/replayPreviewPlayer';
import {StaticReplayPreview} from 'sentry/components/events/eventReplay/staticReplayPreview';
import {LoadingIndicator} from 'sentry/components/loadingIndicator';
import {ArchivedReplayAlert} from 'sentry/components/replays/alerts/archivedReplayAlert';
import {ReplayLoadingState} from 'sentry/components/replays/player/replayLoadingState';
import {t} from 'sentry/locale';
import type {useLoadReplayReader} from 'sentry/utils/replays/hooks/useLoadReplayReader';
import {useLogEventReplayStatus} from 'sentry/utils/replays/hooks/useLogEventReplayStatus';
import {ReplayPlayerPluginsContextProvider} from 'sentry/utils/replays/playback/providers/replayPlayerPluginsContext';
import {ReplayPlayerStateContextProvider} from 'sentry/utils/replays/playback/providers/replayPlayerStateContext';
import {ReplayReaderProvider} from 'sentry/utils/replays/playback/providers/replayReaderProvider';
import {FluidHeight} from 'sentry/views/explore/replays/detail/layout/fluidHeight';

interface Props {
  analyticsContext: string;
  handleBackClick: undefined | (() => void);
  handleForwardClick: undefined | (() => void);
  overlayContent: React.ReactNode;
  replayReaderResult: ReturnType<typeof useLoadReplayReader>;
  query?: Query;
}

export function GroupReplaysPlayer({
  analyticsContext,
  query,
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
      renderError={({onRetry}) => (
        <Alert.Container>
          <Alert
            variant="danger"
            data-test-id="replay-error"
            trailingItems={
              <Button size="xs" onClick={onRetry}>
                {t('Retry')}
              </Button>
            }
          >
            {t('There was an error loading the replay.')}
          </Alert>
        </Alert.Container>
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
          <FluidHeight
            position="relative"
            maxHeight={`${REPLAY_LOADING_HEIGHT_LARGE}px`}
            minHeight={{xl: `${REPLAY_LOADING_HEIGHT_LARGE}px`}}
            overflow="visible"
          >
            <ReplayPlayerPluginsContextProvider>
              <ReplayReaderProvider replay={replay}>
                <ReplayPlayerStateContextProvider>
                  <ReplayPreviewPlayer
                    query={query}
                    errorBeforeReplayStart={replay.getErrorBeforeReplayStart()}
                    replayId={replayReaderResult.replayId}
                    replayRecord={replayReaderResult.replayRecord!}
                    handleBackClick={handleBackClick}
                    handleForwardClick={handleForwardClick}
                    overlayContent={overlayContent}
                    showNextAndPrevious
                    playPauseVariant="secondary"
                  />
                </ReplayPlayerStateContextProvider>
              </ReplayReaderProvider>
            </ReplayPlayerPluginsContextProvider>
          </FluidHeight>
        );
      }}
    </ReplayLoadingState>
  );
}

const StyledNegativeSpaceContainer = styled(NegativeSpaceContainer)`
  height: ${REPLAY_LOADING_HEIGHT_LARGE}px;
  border-radius: ${p => p.theme.radius.md};
`;
