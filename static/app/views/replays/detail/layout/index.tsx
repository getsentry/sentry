import styled from '@emotion/styled';

import ErrorBoundary from 'sentry/components/errorBoundary';
import ReplayTimeline from 'sentry/components/replays/breadcrumbs/replayTimeline';
import ReplayView from 'sentry/components/replays/replayView';
import {space} from 'sentry/styles/space';
import useFullscreen from 'sentry/utils/replays/hooks/useFullscreen';
import {LayoutKey} from 'sentry/utils/replays/hooks/useReplayLayout';
import useUrlParams from 'sentry/utils/useUrlParams';
import Breadcrumbs from 'sentry/views/replays/detail/breadcrumbs';
import FocusArea from 'sentry/views/replays/detail/focusArea';
import FocusTabs from 'sentry/views/replays/detail/focusTabs';
import FluidHeight from 'sentry/views/replays/detail/layout/fluidHeight';
import FluidPanel from 'sentry/views/replays/detail/layout/fluidPanel';
import MeasureSize from 'sentry/views/replays/detail/layout/measureSize';
import SplitPanel from 'sentry/views/replays/detail/layout/splitPanel';
import SideTabs from 'sentry/views/replays/detail/sideTabs';
import TagPanel from 'sentry/views/replays/detail/tagPanel';

const MIN_VIDEO_WIDTH = 325;
const MIN_CONTENT_WIDTH = 325;
const MIN_SIDEBAR_WIDTH = 325;
const MIN_VIDEO_HEIGHT = 200;
const MIN_CONTENT_HEIGHT = 180;
const MIN_SIDEBAR_HEIGHT = 120;

const DIVIDER_SIZE = 16;

type Props = {
  layout?: LayoutKey;
};

function ReplayLayout({layout = LayoutKey.topbar}: Props) {
  const {ref: fullscreenRef, toggle: toggleFullscreen} = useFullscreen();

  const timeline = (
    <ErrorBoundary mini>
      <ReplayTimeline />
    </ErrorBoundary>
  );

  const video = (
    <VideoSection ref={fullscreenRef}>
      <ErrorBoundary mini>
        <ReplayView toggleFullscreen={toggleFullscreen} />
      </ErrorBoundary>
    </VideoSection>
  );

  if (layout === LayoutKey.video_only) {
    return (
      <BodyContent>
        {timeline}
        {video}
      </BodyContent>
    );
  }

  const focusArea = (
    <ErrorBoundary mini>
      <FluidPanel title={<SmallMarginFocusTabs />}>
        <FocusArea />
      </FluidPanel>
    </ErrorBoundary>
  );

  if (layout === LayoutKey.no_video) {
    return (
      <BodyContent>
        {timeline}
        <MeasureSize>
          {({width}) => (
            <SplitPanel
              key={layout}
              availableSize={width}
              left={{
                content: focusArea,
                default: (width - DIVIDER_SIZE) * 0.9,
                min: 0,
                max: width - DIVIDER_SIZE,
              }}
              right={<SideCrumbsTags />}
            />
          )}
        </MeasureSize>
      </BodyContent>
    );
  }

  if (layout === LayoutKey.sidebar_left) {
    return (
      <BodyContent>
        {timeline}
        <MeasureSize>
          {({height, width}) => (
            <SplitPanel
              key={layout}
              availableSize={width}
              left={{
                content: (
                  <SplitPanel
                    key={layout}
                    availableSize={height}
                    top={{
                      content: video,
                      default: (height - DIVIDER_SIZE) * 0.65,
                      min: MIN_CONTENT_HEIGHT,
                      max: height - DIVIDER_SIZE - MIN_SIDEBAR_HEIGHT,
                    }}
                    bottom={<SideCrumbsTags />}
                  />
                ),
                default: (width - DIVIDER_SIZE) * 0.5,
                min: MIN_SIDEBAR_WIDTH,
                max: width - DIVIDER_SIZE - MIN_CONTENT_WIDTH,
              }}
              right={focusArea}
            />
          )}
        </MeasureSize>
      </BodyContent>
    );
  }

  // layout === 'topbar'
  const crumbsWithTitle = (
    <ErrorBoundary mini>
      <Breadcrumbs showTitle />
    </ErrorBoundary>
  );

  return (
    <BodyContent>
      {timeline}
      <MeasureSize>
        {({height, width}) => (
          <SplitPanel
            key={layout}
            availableSize={height}
            top={{
              content: (
                <SplitPanel
                  availableSize={width}
                  left={{
                    content: video,
                    default: (width - DIVIDER_SIZE) * 0.5,
                    min: MIN_VIDEO_WIDTH,
                    max: width - DIVIDER_SIZE - MIN_SIDEBAR_WIDTH,
                  }}
                  right={crumbsWithTitle}
                />
              ),
              default: (height - DIVIDER_SIZE) * 0.5,
              min: MIN_VIDEO_HEIGHT,
              max: height - DIVIDER_SIZE - MIN_CONTENT_HEIGHT,
            }}
            bottom={focusArea}
          />
        )}
      </MeasureSize>
    </BodyContent>
  );
}

function SideCrumbsTags() {
  const {getParamValue} = useUrlParams('t_side', 'crumbs');
  const sideTabs = <SmallMarginSideTabs />;
  if (getParamValue() === 'tags') {
    return (
      <FluidPanel title={sideTabs}>
        <TagPanel />
      </FluidPanel>
    );
  }

  return (
    <FluidPanel title={sideTabs}>
      <ErrorBoundary mini>
        <Breadcrumbs showTitle={false} />
      </ErrorBoundary>
    </FluidPanel>
  );
}

const BodyContent = styled('main')`
  background: ${p => p.theme.background};
  width: 100%;
  height: 100%;
  display: grid;
  grid-template-rows: auto 1fr;
  overflow: hidden;
  padding: ${space(2)};
`;

const SmallMarginFocusTabs = styled(FocusTabs)`
  margin-bottom: ${space(1)};
`;
const SmallMarginSideTabs = styled(SideTabs)`
  margin-bottom: ${space(1)};
`;

const VideoSection = styled(FluidHeight)`
  background: ${p => p.theme.background};
  gap: ${space(1)};

  :fullscreen {
    padding: ${space(1)};
  }
`;

export default ReplayLayout;
