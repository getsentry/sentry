import type {ComponentProps} from 'react';
import {useEffect, useRef, useState} from 'react';
import styled from '@emotion/styled';

import {Button, LinkButton, type LinkButtonProps} from 'sentry/components/button';
import ErrorBoundary from 'sentry/components/errorBoundary';
import {useReplayContext} from 'sentry/components/replays/replayContext';
import ReplayCurrentScreen from 'sentry/components/replays/replayCurrentScreen';
import ReplayCurrentUrl from 'sentry/components/replays/replayCurrentUrl';
import {ReplayFullscreenButton} from 'sentry/components/replays/replayFullscreenButton';
import ReplayPlayer from 'sentry/components/replays/replayPlayer';
import ReplayPlayPauseButton from 'sentry/components/replays/replayPlayPauseButton';
import {ReplaySidebarToggleButton} from 'sentry/components/replays/replaySidebarToggleButton';
import TimeAndScrubberGrid from 'sentry/components/replays/timeAndScrubberGrid';
import {IconNext, IconPrevious} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import EventView from 'sentry/utils/discover/eventView';
import getRouteStringFromRoutes from 'sentry/utils/getRouteStringFromRoutes';
import {TabKey} from 'sentry/utils/replays/hooks/useActiveReplayTab';
import useMarkReplayViewed from 'sentry/utils/replays/hooks/useMarkReplayViewed';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import {useRoutes} from 'sentry/utils/useRoutes';
import useFullscreen from 'sentry/utils/window/useFullscreen';
import useIsFullscreen from 'sentry/utils/window/useIsFullscreen';
import Breadcrumbs from 'sentry/views/replays/detail/breadcrumbs';
import BrowserOSIcons from 'sentry/views/replays/detail/browserOSIcons';
import FluidHeight from 'sentry/views/replays/detail/layout/fluidHeight';
import {makeReplaysPathname} from 'sentry/views/replays/pathnames';
import {ReplayCell} from 'sentry/views/replays/replayTable/tableCell';
import type {ReplayRecord} from 'sentry/views/replays/types';

export default function ReplayPreviewPlayer({
  replayId,
  fullReplayButtonProps,
  replayRecord,
  handleBackClick,
  handleForwardClick,
  overlayContent,
  showNextAndPrevious,
  playPausePriority,
}: {
  replayId: string;
  replayRecord: ReplayRecord;
  fullReplayButtonProps?: Partial<Omit<LinkButtonProps, 'external'>>;
  handleBackClick?: () => void;
  handleForwardClick?: () => void;
  overlayContent?: React.ReactNode;
  playPausePriority?: ComponentProps<typeof ReplayPlayPauseButton>['priority'];
  showNextAndPrevious?: boolean;
}) {
  const routes = useRoutes();
  const location = useLocation();
  const organization = useOrganization();
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const {replay, currentTime, isFetching, isFinished, isPlaying, isVideoReplay} =
    useReplayContext();
  const eventView = EventView.fromLocation(location);

  const fullscreenRef = useRef(null);
  const {toggle: toggleFullscreen} = useFullscreen({
    elementRef: fullscreenRef,
  });
  const isFullscreen = useIsFullscreen();
  const startOffsetMs = replay?.getStartOffsetMs() ?? 0;

  const referrer = getRouteStringFromRoutes(routes);
  const fromFeedback = referrer === '/feedback/';

  const {mutate: markAsViewed} = useMarkReplayViewed();
  useEffect(() => {
    if (replayRecord?.id && !replayRecord.has_viewed && !isFetching && isPlaying) {
      markAsViewed({projectSlug: replayRecord.project_id, replayId: replayRecord.id});
    }
  }, [isFetching, isPlaying, markAsViewed, organization, replayRecord]);

  return (
    <PlayerPanel>
      <HeaderWrapper>
        <StyledReplayCell
          key="session"
          replay={replayRecord}
          eventView={eventView}
          organization={organization}
          referrer="issue-details-replay-header"
        />
        <LinkButton
          size="sm"
          to={{
            pathname: makeReplaysPathname({
              path: `/${replayId}/`,
              organization,
            }),
            query: {
              referrer: getRouteStringFromRoutes(routes),
              t_main: fromFeedback ? TabKey.BREADCRUMBS : TabKey.ERRORS,
              t: (currentTime + startOffsetMs) / 1000,
            },
          }}
          {...fullReplayButtonProps}
        >
          {t('See Full Replay')}
        </LinkButton>
      </HeaderWrapper>
      <PreviewPlayerContainer ref={fullscreenRef} isSidebarOpen={isSidebarOpen}>
        <PlayerBreadcrumbContainer>
          <PlayerContextContainer>
            {isFullscreen ? (
              <ContextContainer>
                {isVideoReplay ? <ReplayCurrentScreen /> : <ReplayCurrentUrl />}
                <BrowserOSIcons />
                <ReplaySidebarToggleButton
                  isOpen={isSidebarOpen}
                  setIsOpen={setIsSidebarOpen}
                />
              </ContextContainer>
            ) : null}
            <StaticPanel>
              <ReplayPlayer overlayContent={overlayContent} isPreview />
            </StaticPanel>
          </PlayerContextContainer>
          {isFullscreen && isSidebarOpen ? <Breadcrumbs /> : null}
        </PlayerBreadcrumbContainer>
        <ErrorBoundary mini>
          <ButtonGrid>
            {showNextAndPrevious && (
              <Button
                size="sm"
                title={t('Previous Clip')}
                icon={<IconPrevious />}
                onClick={() => handleBackClick?.()}
                aria-label={t('Previous Clip')}
                disabled={!handleBackClick}
                analyticsEventName="Replay Preview Player: Clicked Previous Clip"
                analyticsEventKey="replay_preview_player.clicked_previous_clip"
              />
            )}
            <ReplayPlayPauseButton
              analyticsEventName="Replay Preview Player: Clicked Play/Plause Clip"
              analyticsEventKey="replay_preview_player.clicked_play_pause_clip"
              priority={
                playPausePriority ?? (isFinished || isPlaying ? 'primary' : 'default')
              }
            />
            {showNextAndPrevious && (
              <Button
                size="sm"
                title={t('Next Clip')}
                icon={<IconNext />}
                onClick={() => handleForwardClick?.()}
                aria-label={t('Next Clip')}
                disabled={!handleForwardClick}
                analyticsEventName="Replay Preview Player: Clicked Next Clip"
                analyticsEventKey="replay_preview_player.clicked_next_clip"
              />
            )}
            <Container>
              <TimeAndScrubberGrid />
            </Container>
            <ReplayFullscreenButton toggleFullscreen={toggleFullscreen} />
          </ButtonGrid>
        </ErrorBoundary>
      </PreviewPlayerContainer>
    </PlayerPanel>
  );
}

const PlayerPanel = styled('div')`
  display: flex;
  gap: ${space(1)};
  flex-direction: column;
  flex-grow: 1;
  overflow: hidden;
  height: 100%;
`;

const PlayerBreadcrumbContainer = styled(FluidHeight)`
  position: relative;
`;

const PreviewPlayerContainer = styled(FluidHeight)<{isSidebarOpen: boolean}>`
  gap: ${space(2)};
  background: ${p => p.theme.background};

  :fullscreen {
    padding: ${space(1)};

    ${PlayerBreadcrumbContainer} {
      display: grid;
      grid-template-columns: ${p => (p.isSidebarOpen ? '1fr 25%' : '1fr')};
      height: 100%;
      gap: ${space(1)};
    }
  }
`;

const PlayerContextContainer = styled(FluidHeight)`
  display: flex;
  flex-direction: column;
  gap: ${space(1)};
`;

const StaticPanel = styled(FluidHeight)`
  border: 1px solid ${p => p.theme.border};
  border-radius: ${p => p.theme.borderRadius};
`;
const ButtonGrid = styled('div')`
  display: flex;
  align-items: center;
  gap: 0 ${space(1)};
  flex-direction: row;
  justify-content: space-between;
`;

const Container = styled('div')`
  display: flex;
  flex-direction: column;
  flex: 1 1;
  justify-content: center;
`;

const ContextContainer = styled('div')`
  display: grid;
  grid-auto-flow: column;
  grid-template-columns: 1fr max-content max-content;
  align-items: center;
  gap: ${space(1)};
`;

const StyledReplayCell = styled(ReplayCell)`
  padding: 0 0 ${space(1)};
`;

const HeaderWrapper = styled('div')`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: ${space(1)};
`;
