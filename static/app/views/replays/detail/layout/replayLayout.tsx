import {useRef} from 'react';
import styled from '@emotion/styled';

import ErrorBoundary from 'sentry/components/errorBoundary';
import Placeholder from 'sentry/components/placeholder';
import ReplayController from 'sentry/components/replays/replayController';
import ReplayView from 'sentry/components/replays/replayView';
import {space} from 'sentry/styles/space';
import useReplayLayout, {LayoutKey} from 'sentry/utils/replays/hooks/useReplayLayout';
import {useDimensions} from 'sentry/utils/useDimensions';
import useFullscreen from 'sentry/utils/window/useFullscreen';
import FluidHeight from 'sentry/views/replays/detail/layout/fluidHeight';
import FocusArea from 'sentry/views/replays/detail/layout/focusArea';
import FocusTabs from 'sentry/views/replays/detail/layout/focusTabs';
import SplitPanel from 'sentry/views/replays/detail/layout/splitPanel';
import type {ReplayRecord} from 'sentry/views/replays/types';

const MIN_CONTENT_WIDTH = 340;
const MIN_SIDEBAR_WIDTH = 325;
const MIN_VIDEO_HEIGHT = 200;
const MIN_CONTENT_HEIGHT = 180;

const DIVIDER_SIZE = 16;

export default function ReplayLayout({
  isVideoReplay = false,
  replayRecord,
  isLoading,
}: {
  isLoading: boolean;
  replayRecord: ReplayRecord | undefined;
  isVideoReplay?: boolean;
}) {
  const {getLayout} = useReplayLayout();
  const layout = getLayout() ?? LayoutKey.TOPBAR;

  const fullscreenRef = useRef(null);
  const {toggle: toggleFullscreen} = useFullscreen({
    elementRef: fullscreenRef,
  });

  const measureRef = useRef<HTMLDivElement>(null);
  const {width, height} = useDimensions({elementRef: measureRef});

  const video = (
    <VideoSection ref={fullscreenRef}>
      <ErrorBoundary mini>
        <ReplayView toggleFullscreen={toggleFullscreen} isLoading={isLoading} />
      </ErrorBoundary>
    </VideoSection>
  );

  const controller = (
    <ErrorBoundary mini>
      <ReplayController
        isLoading={isLoading}
        toggleFullscreen={toggleFullscreen}
        hideFastForward={isVideoReplay}
      />
    </ErrorBoundary>
  );

  if (layout === LayoutKey.VIDEO_ONLY) {
    return (
      <BodyContent>
        {video}
        {controller}
      </BodyContent>
    );
  }

  const focusArea =
    isLoading || replayRecord?.is_archived ? (
      <Placeholder width="100%" height="100%" />
    ) : (
      <FluidContainer>
        <FocusTabs isVideoReplay={isVideoReplay} />
        <OverflowBody>
          <ErrorBoundary mini>
            <FocusArea isVideoReplay={isVideoReplay} />
          </ErrorBoundary>
        </OverflowBody>
      </FluidContainer>
    );

  const hasSize = width + height > 0;

  if (layout === LayoutKey.NO_VIDEO) {
    return (
      <BodyContent>
        <FluidHeight ref={measureRef}>
          {hasSize ? <PanelContainer key={layout}>{focusArea}</PanelContainer> : null}
        </FluidHeight>
      </BodyContent>
    );
  }

  if (layout === LayoutKey.SIDEBAR_LEFT) {
    return (
      <BodyContent>
        <FluidHeight ref={measureRef}>
          {hasSize ? (
            <SplitPanel
              key={layout}
              availableSize={width}
              left={{
                content: <PanelContainer key={layout}>{video}</PanelContainer>,
                default: width * 0.5,
                min: MIN_SIDEBAR_WIDTH,
                max: width - MIN_CONTENT_WIDTH,
              }}
              right={focusArea}
            />
          ) : null}
        </FluidHeight>
        {controller}
      </BodyContent>
    );
  }

  // layout === 'topbar'
  return (
    <BodyContent>
      <FluidHeight ref={measureRef}>
        {hasSize ? (
          <SplitPanel
            key={layout}
            availableSize={height}
            top={{
              content: <PanelContainer>{video}</PanelContainer>,
              default: (height - DIVIDER_SIZE) * 0.5,
              min: MIN_VIDEO_HEIGHT,
              max: height - DIVIDER_SIZE - MIN_CONTENT_HEIGHT,
            }}
            bottom={focusArea}
          />
        ) : null}
      </FluidHeight>
      {controller}
    </BodyContent>
  );
}

const FluidContainer = styled('section')`
  display: flex;
  flex-direction: column;
  height: 100%;
`;

const OverflowBody = styled('div')`
  flex: 1 1 auto;
  overflow: auto;
`;

const BodyContent = styled('main')`
  background: ${p => p.theme.background};
  width: 100%;
  height: 100%;
  display: grid;
  grid-template-rows: 1fr auto;
  overflow: hidden;
  padding: ${space(2)};
`;

const VideoSection = styled(FluidHeight)`
  background: ${p => p.theme.background};
  gap: ${space(1)};

  :fullscreen {
    padding: ${space(1)};
  }
`;

const PanelContainer = styled('div')`
  width: 100%;
  height: 100%;

  position: relative;
  display: grid;
  overflow: auto;

  &.disable-iframe-pointer iframe {
    pointer-events: none !important;
  }
`;
