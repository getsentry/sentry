import {useRef} from 'react';
import styled from '@emotion/styled';

import {TooltipContext} from 'sentry/components/core/tooltip';
import ErrorBoundary from 'sentry/components/errorBoundary';
import Placeholder from 'sentry/components/placeholder';
import ReplayController from 'sentry/components/replays/replayController';
import ReplayView from 'sentry/components/replays/replayView';
import {space} from 'sentry/styles/space';
import useReplayLayout, {LayoutKey} from 'sentry/utils/replays/hooks/useReplayLayout';
import {useDimensions} from 'sentry/utils/useDimensions';
import useFullscreen from 'sentry/utils/window/useFullscreen';
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
      <TooltipContext value={{container: fullscreenRef.current}}>
        <ErrorBoundary mini>
          <ReplayView toggleFullscreen={toggleFullscreen} isLoading={isLoading} />
        </ErrorBoundary>
      </TooltipContext>
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
      <BodyGrid>
        {video}
        {controller}
      </BodyGrid>
    );
  }

  const focusArea =
    isLoading || replayRecord?.is_archived ? (
      <Placeholder width="100%" height="100%" />
    ) : (
      <FluidContainer>
        <FocusTabs isVideoReplay={isVideoReplay} />

        <ErrorBoundary mini>
          <FocusArea isVideoReplay={isVideoReplay} />
        </ErrorBoundary>
      </FluidContainer>
    );

  const hasSize = width + height > 0;

  if (layout === LayoutKey.NO_VIDEO) {
    return (
      <BodyGrid>
        <BodySlider ref={measureRef}>
          {hasSize ? <PanelContainer key={layout}>{focusArea}</PanelContainer> : null}
        </BodySlider>
      </BodyGrid>
    );
  }

  if (layout === LayoutKey.SIDEBAR_LEFT) {
    return (
      <BodyGrid>
        <BodySlider ref={measureRef}>
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
        </BodySlider>
        {controller}
      </BodyGrid>
    );
  }

  // layout === 'topbar'
  return (
    <BodyGrid>
      <BodySlider ref={measureRef}>
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
      </BodySlider>
      {controller}
    </BodyGrid>
  );
}

const FluidContainer = styled('section')`
  display: grid;
  grid-template-rows: max-content 1fr;
  height: 100%;
  gap: ${space(1)};
`;

const BodyGrid = styled('main')`
  background: ${p => p.theme.tokens.background.primary};

  display: grid;
  grid-template-rows: 1fr auto;
  gap: ${space(2)};
  padding: ${space(2)};

  /*
  Grid items have default \`min-height: auto\` to contain all content.
  https://stackoverflow.com/a/43312314
  */
  min-height: 0;
`;

const BodySlider = styled('div')`
  display: flex;
  flex-direction: column;
  flex-wrap: nowrap;
  min-height: 0;
`;

const VideoSection = styled('div')`
  display: flex;
  flex-direction: column;
  flex-wrap: nowrap;
  flex-grow: 1;

  background: ${p => p.theme.tokens.background.primary};
  gap: ${space(1)};

  :fullscreen {
    padding: ${space(1)};
  }
`;

const PanelContainer = styled('div')`
  position: relative;
  display: flex;
  flex-grow: 1;

  &.disable-iframe-pointer iframe {
    pointer-events: none !important;
  }
`;
