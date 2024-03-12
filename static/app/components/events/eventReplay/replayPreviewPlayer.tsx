import type {ComponentProps} from 'react';
import {useRef, useState} from 'react';
import styled from '@emotion/styled';

import {Button, LinkButton} from 'sentry/components/button';
import ButtonBar from 'sentry/components/buttonBar';
import ErrorBoundary from 'sentry/components/errorBoundary';
import Panel from 'sentry/components/panels/panel';
import {useReplayContext} from 'sentry/components/replays/replayContext';
import ReplayCurrentUrl from 'sentry/components/replays/replayCurrentUrl';
import {ReplayFullscreenButton} from 'sentry/components/replays/replayFullscreenButton';
import ReplayPlayer from 'sentry/components/replays/replayPlayer';
import ReplayPlayPauseButton from 'sentry/components/replays/replayPlayPauseButton';
import {ReplaySidebarToggleButton} from 'sentry/components/replays/replaySidebarToggleButton';
import TimeAndScrubberGrid from 'sentry/components/replays/timeAndScrubberGrid';
import {IconNext, IconPrevious} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {IssueCategory} from 'sentry/types';
import EventView from 'sentry/utils/discover/eventView';
import getRouteStringFromRoutes from 'sentry/utils/getRouteStringFromRoutes';
import {TabKey} from 'sentry/utils/replays/hooks/useActiveReplayTab';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import {useRoutes} from 'sentry/utils/useRoutes';
import useFullscreen from 'sentry/utils/window/useFullscreen';
import useIsFullscreen from 'sentry/utils/window/useIsFullscreen';
import {normalizeUrl} from 'sentry/utils/withDomainRequired';
import Breadcrumbs from 'sentry/views/replays/detail/breadcrumbs';
import BrowserOSIcons from 'sentry/views/replays/detail/browserOSIcons';
import FluidHeight from 'sentry/views/replays/detail/layout/fluidHeight';
import {ReplayCell} from 'sentry/views/replays/replayTable/tableCell';
import type {ReplayRecord} from 'sentry/views/replays/types';

function ReplayPreviewPlayer({
  replayId,
  fullReplayButtonProps,
  replayRecord,
  issueCategory,
  handleBackClick,
  handleForwardClick,
  overlayText,
  showNextAndPrevious,
  onClickNextReplay,
}: {
  replayId: string;
  replayRecord: ReplayRecord;
  fullReplayButtonProps?: Partial<ComponentProps<typeof LinkButton>>;
  handleBackClick?: () => void;
  handleForwardClick?: () => void;
  issueCategory?: IssueCategory;
  onClickNextReplay?: () => void;
  overlayText?: string;
  showNextAndPrevious?: boolean;
}) {
  const routes = useRoutes();
  const location = useLocation();
  const organization = useOrganization();
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const {replay, currentTime, isFinished, isPlaying} = useReplayContext();
  const eventView = EventView.fromLocation(location);

  const fullscreenRef = useRef(null);
  const {toggle: toggleFullscreen} = useFullscreen({
    elementRef: fullscreenRef,
  });
  const isFullscreen = useIsFullscreen();

  const startOffsetMs = replay?.getStartOffsetMs() ?? 0;
  const isRageClickIssue = issueCategory === IssueCategory.REPLAY;

  const fullReplayUrl = {
    pathname: normalizeUrl(`/organizations/${organization.slug}/replays/${replayId}/`),
    query: {
      referrer: getRouteStringFromRoutes(routes),
      t_main: isRageClickIssue ? TabKey.BREADCRUMBS : TabKey.ERRORS,
      t: (currentTime + startOffsetMs) / 1000,
      f_b_type: isRageClickIssue ? 'rageOrDead' : undefined,
    },
  };

  return (
    <PlayerPanel>
      {replayRecord && (
        <ReplayCell
          key="session"
          replay={replayRecord}
          eventView={eventView}
          organization={organization}
          referrer="issue-details-replay-header"
        />
      )}
      <PreviewPlayerContainer ref={fullscreenRef} isSidebarOpen={isSidebarOpen}>
        <PlayerBreadcrumbContainer>
          <PlayerContextContainer>
            {isFullscreen ? (
              <ContextContainer>
                <ReplayCurrentUrl />
                <BrowserOSIcons />
                <ReplaySidebarToggleButton
                  isOpen={isSidebarOpen}
                  setIsOpen={setIsSidebarOpen}
                />
              </ContextContainer>
            ) : null}
            <StaticPanel>
              <ReplayPlayer
                overlayText={overlayText}
                onClickNextReplay={onClickNextReplay}
              />
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
              />
            )}
            <ReplayPlayPauseButton
              priority={isFinished || isPlaying ? 'primary' : 'default'}
            />
            {showNextAndPrevious && (
              <Button
                size="sm"
                title={t('Next Clip')}
                icon={<IconNext />}
                onClick={() => handleForwardClick?.()}
                aria-label={t('Next Clip')}
                disabled={!handleForwardClick}
              />
            )}
            <Container>
              <TimeAndScrubberGrid />
            </Container>
            <ButtonBar gap={1}>
              <LinkButton size="sm" to={fullReplayUrl} {...fullReplayButtonProps}>
                {t('See Full Replay')}
              </LinkButton>
              <ReplayFullscreenButton toggleFullscreen={toggleFullscreen} />
            </ButtonBar>
          </ButtonGrid>
        </ErrorBoundary>
      </PreviewPlayerContainer>
    </PlayerPanel>
  );
}

const PlayerPanel = styled(Panel)`
  padding: ${space(3)} ${space(3)} ${space(1.5)};
  margin: 0;
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

export default ReplayPreviewPlayer;
