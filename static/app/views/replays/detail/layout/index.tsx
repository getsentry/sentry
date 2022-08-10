import {Fragment, useRef} from 'react';
import styled from '@emotion/styled';

import ErrorBoundary from 'sentry/components/errorBoundary';
import ReplayTimeline from 'sentry/components/replays/breadcrumbs/replayTimeline';
import ReplayView from 'sentry/components/replays/replayView';
import space from 'sentry/styles/space';
import useFullscreen from 'sentry/utils/replays/hooks/useFullscreen';
import {LayoutKey} from 'sentry/utils/replays/hooks/useReplayLayout';
import useUrlParams from 'sentry/utils/replays/hooks/useUrlParams';
import useWidth from 'sentry/utils/replays/hooks/useWidth';
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
const MIN_VIDEO_HEIGHT = {px: 200};
const MIN_CONTENT_HEIGHT = {px: 200};
const MIN_CRUMBS_HEIGHT = {px: 200};

type Props = {
  layout?: LayoutKey;
  showCrumbs?: boolean;
  showTimeline?: boolean;
  showVideo?: boolean;
};

function ReplayLayout({
  layout = LayoutKey.topbar,
  showCrumbs = true,
  showTimeline = true,
  showVideo = true,
}: Props) {
  const {ref: fullscreenRef, toggle: toggleFullscreen} = useFullscreen();
  const focusAreaRef = useRef<HTMLDivElement>(null);
  const focusAreaWidth = useWidth(focusAreaRef);

  const timeline = showTimeline ? (
    <ErrorBoundary mini>
      <ReplayTimeline />
    </ErrorBoundary>
  ) : null;

  const video = showVideo ? (
    <VideoSection ref={fullscreenRef}>
      <ErrorBoundary mini>
        <ReplayView toggleFullscreen={toggleFullscreen} />
      </ErrorBoundary>
    </VideoSection>
  ) : null;

  const crumbs = showCrumbs ? (
    <ErrorBoundary mini>
      <Breadcrumbs />
    </ErrorBoundary>
  ) : null;

  const content = (
    <ErrorBoundary mini>
      <FluidPanel title={<FocusTabs />} bodyRef={focusAreaRef}>
        <FocusArea width={focusAreaWidth} />
      </FluidPanel>
    </ErrorBoundary>
  );

  if (layout === 'sidebar_right') {
    return (
      <BodyContent>
        {timeline}
        <SplitPanel
          key={layout}
          left={{
            content,
            default: '60%',
            min: MIN_CONTENT_WIDTH,
          }}
          right={{
            content: <SidebarContent video={video} crumbs={crumbs} />,
            min: MIN_VIDEO_WIDTH,
          }}
        />
      </BodyContent>
    );
  }

  if (layout === 'sidebar_left') {
    return (
      <BodyContent>
        {timeline}
        <SplitPanel
          key={layout}
          left={{
            content: <SidebarContent video={video} crumbs={crumbs} />,
            min: MIN_VIDEO_WIDTH,
          }}
          right={{
            content,
            default: '60%',
            min: MIN_CONTENT_WIDTH,
          }}
        />
      </BodyContent>
    );
  }

  // layout === 'topbar' or default
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
                default: '70%',
                min: MIN_VIDEO_WIDTH,
              }}
              right={{
                content: crumbs,
              }}
            />
          ),

          min: MIN_VIDEO_HEIGHT,
        }}
        bottom={{
          content,
          default: '60%',
          min: MIN_CONTENT_HEIGHT,
        }}
      />
    </BodyContent>
  );
}

function SidebarContent({video, crumbs}) {
  const {getParamValue} = useUrlParams('t_side', 'video');
  if (getParamValue() === 'tags') {
    return (
      <FluidPanel title={<SideTabs />}>
        <TagPanel />
      </FluidPanel>
    );
  }
  if (video && crumbs) {
    return (
      <FluidPanel title={<SideTabs />}>
        <SplitPanel
          top={{
            content: video,
            default: '55%',
            min: MIN_VIDEO_HEIGHT,
          }}
          bottom={{
            content: crumbs,
            min: MIN_CRUMBS_HEIGHT,
          }}
        />
      </FluidPanel>
    );
  }
  return (
    <Fragment>
      {video}
      {crumbs}
    </Fragment>
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

const VideoSection = styled(FluidHeight)`
  height: 100%;

  background: ${p => p.theme.background};
  gap: ${space(1)};
`;

export default ReplayLayout;
