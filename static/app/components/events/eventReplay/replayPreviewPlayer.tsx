import type {ComponentProps} from 'react';
import {useEffect, useRef, useState} from 'react';
import styled from '@emotion/styled';
import type {Query} from 'history';

import {Alert} from 'sentry/components/core/alert';
import {Button} from 'sentry/components/core/button';
import {LinkButton, type LinkButtonProps} from 'sentry/components/core/button/linkButton';
import {TooltipContext} from 'sentry/components/core/tooltip';
import ErrorBoundary from 'sentry/components/errorBoundary';
import {useReplayContext} from 'sentry/components/replays/replayContext';
import ReplayCurrentScreen from 'sentry/components/replays/replayCurrentScreen';
import ReplayCurrentUrl from 'sentry/components/replays/replayCurrentUrl';
import {ReplayFullscreenButton} from 'sentry/components/replays/replayFullscreenButton';
import ReplayPlayer from 'sentry/components/replays/replayPlayer';
import ReplayPlayPauseButton from 'sentry/components/replays/replayPlayPauseButton';
import {ReplaySidebarToggleButton} from 'sentry/components/replays/replaySidebarToggleButton';
import {ReplaySessionColumn} from 'sentry/components/replays/table/replayTableColumns';
import TimeAndScrubberGrid from 'sentry/components/replays/timeAndScrubberGrid';
import {IconNext, IconPrevious} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import getRouteStringFromRoutes from 'sentry/utils/getRouteStringFromRoutes';
import {TabKey} from 'sentry/utils/replays/hooks/useActiveReplayTab';
import useMarkReplayViewed from 'sentry/utils/replays/hooks/useMarkReplayViewed';
import {TimelineScaleContextProvider} from 'sentry/utils/replays/hooks/useTimelineScale';
import {useReplayReader} from 'sentry/utils/replays/playback/providers/replayReaderProvider';
import useOrganization from 'sentry/utils/useOrganization';
import {useParams} from 'sentry/utils/useParams';
import {useRoutes} from 'sentry/utils/useRoutes';
import useFullscreen from 'sentry/utils/window/useFullscreen';
import useIsFullscreen from 'sentry/utils/window/useIsFullscreen';
import Breadcrumbs from 'sentry/views/replays/detail/breadcrumbs';
import BrowserOSIcons from 'sentry/views/replays/detail/browserOSIcons';
import FluidHeight from 'sentry/views/replays/detail/layout/fluidHeight';
import {makeReplaysPathname} from 'sentry/views/replays/pathnames';
import type {ReplayListRecord, ReplayRecord} from 'sentry/views/replays/types';

export default function ReplayPreviewPlayer({
  query,
  errorBeforeReplayStart,
  replayId,
  fullReplayButtonProps,
  replayRecord,
  handleBackClick,
  handleForwardClick,
  overlayContent,
  showNextAndPrevious,
  playPausePriority,
}: {
  errorBeforeReplayStart: boolean;
  replayId: string;
  replayRecord: ReplayRecord;
  fullReplayButtonProps?: Partial<Omit<LinkButtonProps, 'external'>>;
  handleBackClick?: () => void;
  handleForwardClick?: () => void;
  overlayContent?: React.ReactNode;
  playPausePriority?: ComponentProps<typeof ReplayPlayPauseButton>['priority'];
  query?: Query;
  showNextAndPrevious?: boolean;
}) {
  const routes = useRoutes();
  const organization = useOrganization();
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const replay = useReplayReader();
  const {currentTime, isFetching, isFinished, isPlaying, isVideoReplay} =
    useReplayContext();

  const fullscreenRef = useRef<HTMLDivElement | null>(null);
  const {toggle: toggleFullscreen} = useFullscreen({
    elementRef: fullscreenRef,
  });
  const isFullscreen = useIsFullscreen();
  const startOffsetMs = replay?.getStartOffsetMs() ?? 0;

  const referrer = getRouteStringFromRoutes(routes);
  const fromFeedback = referrer === '/issues/feedback/';

  const {groupId} = useParams<{groupId: string}>();

  const {mutate: markAsViewed} = useMarkReplayViewed();
  useEffect(() => {
    if (
      !replayRecord.is_archived &&
      !replayRecord.has_viewed &&
      !isFetching &&
      isPlaying
    ) {
      markAsViewed({projectSlug: replayRecord.project_id, replayId: replayRecord.id});
    }
  }, [isFetching, isPlaying, markAsViewed, organization, replayRecord]);

  return (
    <PlayerPanel>
      {errorBeforeReplayStart && (
        <StyledAlert variant="warning">
          {t(
            'For this event, the replay recording started after the error happened, so the replay below shows the user experience after the error.'
          )}
        </StyledAlert>
      )}
      <HeaderWrapper>
        <ReplaySessionColumn.Component
          to={{
            pathname: makeReplaysPathname({path: `/${replayId}/`, organization}),
            query,
          }}
          replay={replayRecord as ReplayListRecord}
          rowIndex={0}
          columnIndex={0}
          showDropdownFilters={false}
        />
        <ContainedLinkButton
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
              groupId,
              ...query,
            },
          }}
          {...fullReplayButtonProps}
        >
          {t('See Full Replay')}
        </ContainedLinkButton>
      </HeaderWrapper>
      <PreviewPlayerContainer ref={fullscreenRef} isSidebarOpen={isSidebarOpen}>
        <TooltipContext value={{container: fullscreenRef.current}}>
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
                <TimelineScaleContextProvider>
                  <TimeAndScrubberGrid />
                </TimelineScaleContextProvider>
              </Container>
              <ReplayFullscreenButton toggleFullscreen={toggleFullscreen} />
            </ButtonGrid>
          </ErrorBoundary>
        </TooltipContext>
      </PreviewPlayerContainer>
    </PlayerPanel>
  );
}

const PlayerPanel = styled('div')`
  display: flex;
  gap: ${space(1)};
  flex-direction: column;
  flex-grow: 1;
  height: 100%;
`;

const PlayerBreadcrumbContainer = styled(FluidHeight)`
  position: relative;
`;

const PreviewPlayerContainer = styled(FluidHeight)<{isSidebarOpen: boolean}>`
  gap: ${space(2)};
  background: ${p => p.theme.tokens.background.primary};
  height: unset;
  overflow: unset;

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
  border: 1px solid ${p => p.theme.tokens.border.primary};
  border-radius: ${p => p.theme.radius.md};
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

const HeaderWrapper = styled('div')`
  position: relative;
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: ${space(1)};
`;

const StyledAlert = styled(Alert)`
  margin: ${space(1)} 0;
`;

const ContainedLinkButton = styled(LinkButton)`
  position: absolute;
  right: 0;
  top: 3px;
`;
