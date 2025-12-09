import {Fragment, useMemo, useState} from 'react';
import styled from '@emotion/styled';

import {Flex} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

import NegativeSpaceContainer from 'sentry/components/container/negativeSpaceContainer';
import {Button} from 'sentry/components/core/button';
import {REPLAY_LOADING_HEIGHT} from 'sentry/components/events/eventReplay/constants';
import ReplayPreviewPlayer from 'sentry/components/events/eventReplay/replayPreviewPlayer';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import ReplayLoadingState from 'sentry/components/replays/player/replayLoadingState';
import {Provider as ReplayContextProvider} from 'sentry/components/replays/replayContext';
import {IconNext, IconPlay, IconPrevious, IconUser} from 'sentry/icons';
import {t, tn} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import useLoadReplayReader from 'sentry/utils/replays/hooks/useLoadReplayReader';
import useReplayList from 'sentry/utils/replays/hooks/useReplayList';
import {ReplayPlayerPluginsContextProvider} from 'sentry/utils/replays/playback/providers/replayPlayerPluginsContext';
import {ReplayPlayerStateContextProvider} from 'sentry/utils/replays/playback/providers/replayPlayerStateContext';
import {ReplayReaderProvider} from 'sentry/utils/replays/playback/providers/replayReaderProvider';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import FluidHeight from 'sentry/views/replays/detail/layout/fluidHeight';
import type {ReplayListLocationQuery, ReplayListRecord} from 'sentry/views/replays/types';

import useReplaysForCluster from './useReplaysForCluster';

interface Props {
  groupIds: number[];
}

/**
 * Component to display session replays for a cluster of issues.
 */
export default function ClusterReplays({groupIds}: Props) {
  const organization = useOrganization();
  const location = useLocation<ReplayListLocationQuery>();

  const {
    eventView,
    isFetching: isFetchingIds,
    replayCount,
  } = useReplaysForCluster({
    groupIds,
    location,
    orgSlug: organization.slug,
  });

  // If no event view, we don't have replays
  if (!eventView) {
    if (isFetchingIds) {
      return (
        <CenteredContainer>
          <LoadingIndicator mini />
        </CenteredContainer>
      );
    }

    return (
      <CenteredContainer>
        <Flex direction="column" align="center" gap="sm">
          <IconUser size="lg" color="gray300" />
          <Text size="sm" variant="muted">
            {t('No replays available for this cluster')}
          </Text>
        </Flex>
      </CenteredContainer>
    );
  }

  return <ClusterReplaysContent eventView={eventView} replayCount={replayCount} />;
}

function ClusterReplaysContent({
  eventView,
  replayCount,
}: {
  eventView: NonNullable<ReturnType<typeof useReplaysForCluster>['eventView']>;
  replayCount: number;
}) {
  const organization = useOrganization();
  const [selectedIndex, setSelectedIndex] = useState(0);

  const replayListData = useReplayList({
    enabled: true,
    eventView,
    location: useMemo(() => ({query: {}}) as Location<ReplayListLocationQuery>, []),
    organization,
    queryReferrer: 'issueReplays',
    perPage: 10, // Limit to first 10 replays for performance
  });

  const {replays, isFetching, fetchError} = replayListData;
  const selectedReplay = replays?.[selectedIndex];

  if (isFetching) {
    return (
      <CenteredContainer>
        <LoadingIndicator mini />
      </CenteredContainer>
    );
  }

  if (fetchError) {
    return (
      <CenteredContainer>
        <Text size="sm" variant="muted">
          {t('Failed to load replays')}
        </Text>
      </CenteredContainer>
    );
  }

  if (!replays || replays.length === 0) {
    return (
      <CenteredContainer>
        <Flex direction="column" align="center" gap="sm">
          <IconUser size="lg" color="gray300" />
          <Text size="sm" variant="muted">
            {t('No replays available for this cluster')}
          </Text>
        </Flex>
      </CenteredContainer>
    );
  }

  return (
    <Flex direction="column" gap="sm">
      <Flex align="center" justify="space-between">
        <Text size="sm" variant="muted">
          {tn(
            '%s replay across issues in this cluster',
            '%s replays across issues in this cluster',
            replayCount
          )}
        </Text>
        {replays.length > 1 && (
          <Flex align="center" gap="xs">
            <Button
              size="xs"
              icon={<IconPrevious />}
              aria-label={t('Previous replay')}
              disabled={selectedIndex <= 0}
              onClick={() => setSelectedIndex(prev => prev - 1)}
            />
            <Text size="sm">
              {selectedIndex + 1} / {replays.length}
            </Text>
            <Button
              size="xs"
              icon={<IconNext />}
              aria-label={t('Next replay')}
              disabled={selectedIndex >= replays.length - 1}
              onClick={() => setSelectedIndex(prev => prev + 1)}
            />
          </Flex>
        )}
      </Flex>

      {selectedReplay && (
        <ReplayPlayerWrapper
          key={selectedReplay.id}
          replay={selectedReplay}
          replays={replays}
          selectedIndex={selectedIndex}
          setSelectedIndex={setSelectedIndex}
        />
      )}
    </Flex>
  );
}

interface Location<T> {
  query: T;
}

function ReplayPlayerWrapper({
  replay,
  replays,
  selectedIndex,
  setSelectedIndex,
}: {
  replay: ReplayListRecord;
  replays: ReplayListRecord[];
  selectedIndex: number;
  setSelectedIndex: (index: number | ((prev: number) => number)) => void;
}) {
  const organization = useOrganization();

  const readerResult = useLoadReplayReader({
    orgSlug: organization.slug,
    replaySlug: replay.id,
  });

  const {status, replay: replayReader} = readerResult;

  const handleForwardClick =
    selectedIndex + 1 < replays.length
      ? () => setSelectedIndex(prev => prev + 1)
      : undefined;

  const handleBackClick =
    selectedIndex > 0 ? () => setSelectedIndex(prev => prev - 1) : undefined;

  const nextReplay = replays[selectedIndex + 1];
  const overlayContent = nextReplay ? (
    <ReplayOverlayContent
      nextReplay={nextReplay}
      onPlayNext={() => setSelectedIndex(selectedIndex + 1)}
    />
  ) : null;

  return (
    <ReplayContextProvider
      analyticsContext="cluster_replays"
      isFetching={status === 'pending'}
      replay={replayReader}
      autoStart
    >
      <ReplayLoadingState
        readerResult={readerResult}
        renderArchived={() => (
          <ArchivedContainer>
            <Text size="sm" variant="muted">
              {t('This replay has been deleted.')}
            </Text>
          </ArchivedContainer>
        )}
        renderLoading={() => (
          <StyledNegativeSpaceContainer>
            <LoadingIndicator />
          </StyledNegativeSpaceContainer>
        )}
      >
        {({replay: loadedReplay}) => {
          if (loadedReplay.getDurationMs() <= 0) {
            return (
              <EmptyReplayContainer>
                <Text size="sm" variant="muted">
                  {t('This replay has no playable content.')}
                </Text>
              </EmptyReplayContainer>
            );
          }

          return (
            <PlayerContainer>
              <ReplayPlayerPluginsContextProvider>
                <ReplayReaderProvider replay={loadedReplay}>
                  <ReplayPlayerStateContextProvider>
                    <ReplayPreviewPlayer
                      replayId={readerResult.replayId}
                      replayRecord={readerResult.replayRecord!}
                      errorBeforeReplayStart={loadedReplay.getErrorBeforeReplayStart()}
                      fullReplayButtonProps={{}}
                      handleBackClick={handleBackClick}
                      handleForwardClick={handleForwardClick}
                      overlayContent={overlayContent}
                      showNextAndPrevious={replays.length > 1}
                      playPausePriority="default"
                    />
                  </ReplayPlayerStateContextProvider>
                </ReplayReaderProvider>
              </ReplayPlayerPluginsContextProvider>
            </PlayerContainer>
          );
        }}
      </ReplayLoadingState>
    </ReplayContextProvider>
  );
}

function ReplayOverlayContent({
  nextReplay,
  onPlayNext,
}: {
  nextReplay: ReplayListRecord;
  onPlayNext: () => void;
}) {
  const nextReplayName = nextReplay.user.display_name || t('Anonymous User');

  return (
    <Fragment>
      <UpNext>{t('Up Next')}</UpNext>
      <OverlayText>{nextReplayName}</OverlayText>
      <Button onClick={onPlayNext} icon={<IconPlay size="md" />} priority="primary">
        {t('Play Now')}
      </Button>
    </Fragment>
  );
}

const CenteredContainer = styled('div')`
  display: flex;
  align-items: center;
  justify-content: center;
  padding: ${space(3)};
  min-height: 120px;
`;

const PlayerContainer = styled(FluidHeight)`
  position: relative;
  max-height: ${REPLAY_LOADING_HEIGHT + 16}px;
  @media (min-width: ${p => p.theme.breakpoints.sm}) {
    min-height: ${REPLAY_LOADING_HEIGHT + 16}px;
  }
  overflow: unset;
`;

const StyledNegativeSpaceContainer = styled(NegativeSpaceContainer)`
  height: ${REPLAY_LOADING_HEIGHT}px;
  border-radius: ${p => p.theme.borderRadius};
`;

const ArchivedContainer = styled('div')`
  display: flex;
  align-items: center;
  justify-content: center;
  height: ${REPLAY_LOADING_HEIGHT}px;
  background: ${p => p.theme.backgroundSecondary};
  border-radius: ${p => p.theme.borderRadius};
`;

const EmptyReplayContainer = styled('div')`
  display: flex;
  align-items: center;
  justify-content: center;
  height: ${REPLAY_LOADING_HEIGHT}px;
  background: ${p => p.theme.backgroundSecondary};
  border-radius: ${p => p.theme.borderRadius};
`;

const UpNext = styled('div')`
  font-size: ${p => p.theme.fontSize.sm};
  color: white;
  opacity: 0.8;
`;

const OverlayText = styled('div')`
  font-size: ${p => p.theme.fontSize.xl};
  color: white;
  font-weight: 600;
`;
