import styled from '@emotion/styled';

import NegativeSpaceContainer from 'sentry/components/container/negativeSpaceContainer';
import ReplayPreviewPlayer from 'sentry/components/events/eventReplay/replayPreviewPlayer';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import Panel from 'sentry/components/panels/panel';
import ArchivedReplayAlert from 'sentry/components/replays/alerts/archivedReplayAlert';
import ReplayLoadingState from 'sentry/components/replays/player/replayLoadingState';
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
    <PanelNoMargin>
      <ReplayLoadingState
        readerResult={replayReaderResult}
        renderArchived={() => (
          <ArchivedReplayAlert
            message={t('The replay for this event has been deleted.')}
          />
        )}
        renderLoading={() => (
          <NegativeSpaceContainer data-test-id="replay-loading-placeholder">
            <LoadingIndicator />
          </NegativeSpaceContainer>
        )}
      >
        {({replay}) => (
          <ReplayPlayerPluginsContextProvider>
            <ReplayReaderProvider replay={replay}>
              <ReplayPlayerStateContextProvider>
                <ReplayPreviewPlayer
                  errorBeforeReplayStart={replay.getErrorBeforeReplayStart()}
                  replayId={replayReaderResult.replayId}
                  replayRecord={replay.getReplay()}
                  // handleBackClick={handleBackClick}
                  // handleForwardClick={handleForwardClick}
                  // overlayContent={overlayContent}
                  showNextAndPrevious
                  playPausePriority="default"
                />
              </ReplayPlayerStateContextProvider>
            </ReplayReaderProvider>
          </ReplayPlayerPluginsContextProvider>
        )}
      </ReplayLoadingState>
    </PanelNoMargin>
  );
}

const PanelNoMargin = styled(Panel)`
  margin-bottom: 0;
`;
