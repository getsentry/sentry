import NegativeSpaceContainer from 'sentry/components/container/negativeSpaceContainer';
import {Flex} from 'sentry/components/core/layout/flex';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import ArchivedReplayAlert from 'sentry/components/replays/alerts/archivedReplayAlert';
import ReplayLoadingState from 'sentry/components/replays/player/replayLoadingState';
import ReplayPlayer from 'sentry/components/replays/player/replayPlayer';
import ReplayPlayerMeasurer from 'sentry/components/replays/player/replayPlayerMeasurer';
import ReplayController from 'sentry/components/replays/replayController';
import {t} from 'sentry/locale';
import useLoadReplayReader from 'sentry/utils/replays/hooks/useLoadReplayReader';
import {ReplayPlayerPluginsContextProvider} from 'sentry/utils/replays/playback/providers/replayPlayerPluginsContext';
import {ReplayPlayerStateContextProvider} from 'sentry/utils/replays/playback/providers/replayPlayerStateContext';
import {ReplayReaderProvider} from 'sentry/utils/replays/playback/providers/replayReaderProvider';
import useOrganization from 'sentry/utils/useOrganization';

interface Props {
  replaySlug: string;
}

export default function ReplayAssertionsPlayer({replaySlug}: Props) {
  const organization = useOrganization();

  const replayReaderResult = useLoadReplayReader({
    orgSlug: organization.slug,
    replaySlug,
    clipWindow: undefined,
    eventTimestampMs: undefined,
    group: undefined,
  });

  return (
    <ReplayLoadingState
      readerResult={replayReaderResult}
      renderArchived={() => (
        <ArchivedReplayAlert message={t('The replay for this event has been deleted.')} />
      )}
      renderLoading={() => (
        <NegativeSpaceContainer data-test-id="replay-loading-placeholder">
          <LoadingIndicator />
        </NegativeSpaceContainer>
      )}
    >
      {({replay}) => (
        <Flex>
          <Flex direction="column" gap="md" flex="1">
            <ReplayPlayerPluginsContextProvider>
              <ReplayReaderProvider replay={replay}>
                <ReplayPlayerStateContextProvider>
                  <NegativeSpaceContainer>
                    <ReplayPlayerMeasurer measure="width">
                      {style => <ReplayPlayer style={style} />}
                    </ReplayPlayerMeasurer>
                  </NegativeSpaceContainer>
                  <ReplayController toggleFullscreen={() => {}} isLoading={false} />

                  {/* <ReplayPreviewPlayer
                  errorBeforeReplayStart={replay.getErrorBeforeReplayStart()}
                  replayId={replayReaderResult.replayId}
                  replayRecord={replay.getReplay()}
                  // handleBackClick={handleBackClick}
                  // handleForwardClick={handleForwardClick}
                  // overlayContent={overlayContent}
                  showNextAndPrevious
                  playPausePriority="default"
                /> */}
                </ReplayPlayerStateContextProvider>
              </ReplayReaderProvider>
            </ReplayPlayerPluginsContextProvider>
          </Flex>
        </Flex>
      )}
    </ReplayLoadingState>
  );
}
