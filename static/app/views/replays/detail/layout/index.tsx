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
import SplitPanel from 'sentry/views/replays/detail/layout/splitPanel';
import SideTabs from 'sentry/views/replays/detail/sideTabs';
import TagPanel from 'sentry/views/replays/detail/tagPanel';

const MIN_VIDEO_WIDTH = {px: 325};
const MIN_CONTENT_WIDTH = {px: 325};
const MIN_SIDEBAR_WIDTH = {px: 325};
const MIN_VIDEO_HEIGHT = {px: 200};
const MIN_CONTENT_HEIGHT = {px: 180};
const MIN_SIDEBAR_HEIGHT = {px: 120};

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
        <SplitPanel
          key={layout}
          left={{
            content: focusArea,
            default: '1fr',
            min: MIN_CONTENT_WIDTH,
          }}
          right={{
            content: <SideCrumbsTags />,
            min: MIN_SIDEBAR_WIDTH,
          }}
        />
      </BodyContent>
    );
  }

  const sideVideoCrumbs = (
    <SplitPanel
      key={layout}
      top={{
        content: video,
        default: '65%',
        min: MIN_CONTENT_WIDTH,
      }}
      bottom={{
        content: <SideCrumbsTags />,
        min: MIN_SIDEBAR_HEIGHT,
      }}
    />
  );

  if (layout === LayoutKey.sidebar_left) {
    return (
      <BodyContent>
        {timeline}
        <SplitPanel
          key={layout}
          left={{
            content: sideVideoCrumbs,
            min: MIN_SIDEBAR_WIDTH,
          }}
          right={{
            content: focusArea,
            default: '1fr',
            min: MIN_CONTENT_WIDTH,
          }}
        />
      </BodyContent>
    );
  }

  // layout === 'topbar' or default
  const crumbsWithTitle = (
    <ErrorBoundary mini>
      <Breadcrumbs showTitle />
    </ErrorBoundary>
  );

  return (
    <BodyContent>
      {timeline}
      <SplitPanel
        key={layout}
        top={{
          content: (
            <SplitPanel
              left={{
                content: video,
                default: '1fr',
                min: MIN_VIDEO_WIDTH,
              }}
              right={{
                content: crumbsWithTitle,
              }}
            />
          ),
          min: MIN_VIDEO_HEIGHT,
        }}
        bottom={{
          content: focusArea,
          default: '1fr',
          min: MIN_CONTENT_HEIGHT,
        }}
      />
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
