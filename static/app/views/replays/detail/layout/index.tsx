import {Fragment} from 'react';
import styled from '@emotion/styled';

import ErrorBoundary from 'sentry/components/errorBoundary';
import ReplayTimeline from 'sentry/components/replays/breadcrumbs/replayTimeline';
import ReplayView from 'sentry/components/replays/replayView';
import space from 'sentry/styles/space';
import useFullscreen from 'sentry/utils/replays/hooks/useFullscreen';
import useUrlParams from 'sentry/utils/replays/hooks/useUrlParams';
import Breadcrumbs from 'sentry/views/replays/detail/breadcrumbs';
import FocusArea from 'sentry/views/replays/detail/focusArea';
import FocusTabs from 'sentry/views/replays/detail/focusTabs';
import FluidPanel from 'sentry/views/replays/detail/layout/fluidPanel';
import SplitPanel from 'sentry/views/replays/detail/layout/splitPanel';
import SideTabs from 'sentry/views/replays/detail/sideTabs';
import TagPanel from 'sentry/views/replays/detail/tagPanel';

type Layout =
  /**
   * ### Sidebar Right
   * ┌───────────────────┐
   * │ Timeline          │
   * ├──────────┬────────┤
   * │ Details  > Video  │
   * │          >        │
   * │          >^^^^^^^^┤
   * │          > Crumbs │
   * │          >        │
   * └──────────┴────────┘
   */
  | 'sidebar_right'
  /**
   * ### Sidebar Left
   * ┌───────────────────┐
   * │ Timeline          │
   * ├────────┬──────────┤
   * │ Video  > Details  │
   * │        >          │
   * │^^^^^^^ >          |
   * │ Crumbs >          │
   * │        >          │
   * └────────┴──────────┘
   */
  | 'sidebar_left'
  /**
   * ### Topbar
   *┌────────────────────┐
   *│ Timeline           │
   *├───────────┬────────┤
   *│ Video     │ Crumbs │
   *│           │        │
   *├^^^^^^^^^^^^^^^^^^^^┤
   *│ Details            │
   *│                    │
   *└────────────────────┘
   */
  | 'topbar';

type Props = {
  layout?: Layout;
  showCrumbs?: boolean;
  showTimeline?: boolean;
  showVideo?: boolean;
};

function ReplayLayout({
  layout = 'topbar',
  showCrumbs = true,
  showTimeline = true,
  showVideo = true,
}: Props) {
  const {ref: fullscreenRef, isFullscreen, toggle: toggleFullscreen} = useFullscreen();

  const timeline = showTimeline ? (
    <ErrorBoundary mini>
      <ReplayTimeline />
    </ErrorBoundary>
  ) : null;

  const video = showVideo ? (
    <VideoSection ref={fullscreenRef}>
      <ErrorBoundary mini>
        <ReplayView toggleFullscreen={toggleFullscreen} isFullscreen={isFullscreen} />
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
      <FluidPanel title={<FocusTabs />}>
        <FocusArea />
      </FluidPanel>
    </ErrorBoundary>
  );

  if (layout === 'sidebar_right') {
    return (
      <BodyContent>
        {timeline}
        <SplitPanel
          left={{
            content,
            default: '60%',
            min: {px: 325},
          }}
          right={{
            content: <SidebarContent video={video} crumbs={crumbs} />,
            default: '325px',
            min: {px: 325},
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
          left={{
            content: <SidebarContent video={video} crumbs={crumbs} />,
            default: '325px',
            min: {px: 325},
          }}
          right={{
            content,
            default: '60%',
            min: {px: 325},
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
        top={{
          content: (
            <Topbar>
              {video}
              {crumbs}
            </Topbar>
          ),
          default: '325px',
          min: {px: 225},
        }}
        bottom={{
          content,
          min: {px: 200},
        }}
      />
    </BodyContent>
  );
}

function SidebarContent({video, crumbs}) {
  const {getParamValue} = useUrlParams('t_side', 'video');
  if (getParamValue() === 'tags') {
    return (
      <Fragment>
        <SideTabs />
        <TagPanel />
      </Fragment>
    );
  }
  if (video && crumbs) {
    return (
      <FluidPanel title={<SideTabs />} scroll={false}>
        <SplitPanel
          top={{
            content: video,
            default: '55%',
            min: {px: 200},
          }}
          bottom={{
            content: crumbs,
            min: {px: 200},
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

const Topbar = styled('div')`
  height: 100%;
  display: flex;
  flex-grow: 1;
  flex-wrap: nowrap;
  flex-direction: row;
  gap: ${space(3)};
`;

export const VideoSection = styled('section')`
  height: 100%;
  display: flex;
  flex-grow: 1;
  flex-wrap: nowrap;
  flex-direction: column;
`;

export default ReplayLayout;
