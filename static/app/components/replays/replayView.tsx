import {Fragment, useState} from 'react';
import styled from '@emotion/styled';

import {useReplayContext} from 'sentry/components/replays/replayContext';
import ReplayController from 'sentry/components/replays/replayController';
import ReplayCurrentUrl from 'sentry/components/replays/replayCurrentUrl';
import ReplayPlayer from 'sentry/components/replays/replayPlayer';
import ReplayProcessingError from 'sentry/components/replays/replayProcessingError';
import {ReplaySidebarToggleButton} from 'sentry/components/replays/replaySidebarToggleButton';
import {space} from 'sentry/styles/space';
import useIsFullscreen from 'sentry/utils/window/useIsFullscreen';
import Breadcrumbs from 'sentry/views/replays/detail/breadcrumbs';
import BrowserOSIcons from 'sentry/views/replays/detail/browserOSIcons';
import FluidHeight from 'sentry/views/replays/detail/layout/fluidHeight';

import {CanvasSupportNotice} from './canvasSupportNotice';

type Props = {
  toggleFullscreen: () => void;
};

function ReplayView({toggleFullscreen}: Props) {
  const isFullscreen = useIsFullscreen();
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const {isFetching, replay} = useReplayContext();
  const isVideoReplay = replay?.isVideoReplay();

  return (
    <Fragment>
      <PlayerBreadcrumbContainer>
        <PlayerContainer>
          <ContextContainer>
            <ReplayCurrentUrl />
            <BrowserOSIcons showBrowser={!isVideoReplay} />
            {isFullscreen ? (
              <ReplaySidebarToggleButton
                isOpen={isSidebarOpen}
                setIsOpen={setIsSidebarOpen}
              />
            ) : null}
          </ContextContainer>
          {!isFetching && replay?.hasProcessingErrors() ? (
            <ReplayProcessingError processingErrors={replay.processingErrors()} />
          ) : (
            <FluidHeight>
              <CanvasSupportNotice />
              <Panel>
                <ReplayPlayer />
              </Panel>
            </FluidHeight>
          )}
        </PlayerContainer>
        {isFullscreen && isSidebarOpen ? (
          <BreadcrumbContainer>
            <Breadcrumbs />
          </BreadcrumbContainer>
        ) : null}
      </PlayerBreadcrumbContainer>
      {isFullscreen ? (
        <ReplayController
          toggleFullscreen={toggleFullscreen}
          hideFastForward={isVideoReplay}
        />
      ) : null}
    </Fragment>
  );
}

const Panel = styled(FluidHeight)`
  background: ${p => p.theme.background};
  border-radius: ${p => p.theme.borderRadius};
  border: 1px solid ${p => p.theme.border};
  box-shadow: ${p => p.theme.dropShadowMedium};
`;

const ContextContainer = styled('div')`
  display: grid;
  grid-auto-flow: column;
  grid-template-columns: 1fr max-content max-content;
  align-items: center;
  gap: ${space(1)};
`;

const PlayerContainer = styled('div')`
  display: grid;
  grid-auto-flow: row;
  grid-template-rows: auto 1fr;
  gap: ${space(1)};
  flex-grow: 1;
`;

const BreadcrumbContainer = styled('div')`
  width: 25%;
`;

const PlayerBreadcrumbContainer = styled('div')`
  display: flex;
  flex-direction: row;
  height: 100%;
  gap: ${space(1)};
`;

export default ReplayView;
