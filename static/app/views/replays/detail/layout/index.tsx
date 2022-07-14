import styled from '@emotion/styled';

import ErrorBoundary from 'sentry/components/errorBoundary';
import ReplayTimeline from 'sentry/components/replays/breadcrumbs/replayTimeline';
import ReplayView from 'sentry/components/replays/replayView';
import space from 'sentry/styles/space';
import useFullscreen from 'sentry/utils/replays/hooks/useFullscreen';
import Breadcrumbs from 'sentry/views/replays/detail/breadcrumbs';
import FocusArea from 'sentry/views/replays/detail/focusArea';
import FocusTabs from 'sentry/views/replays/detail/focusTabs';
import FluidPanel from 'sentry/views/replays/detail/layout/fluidPanel';
import SplitPanel from 'sentry/views/replays/detail/layout/splitPanel';
import SideTabs from 'sentry/views/replays/detail/sideTabs';

import {TimelineSection, TopbarSection, VideoSection} from './pageSections';
import Sidebar from './sidebar';

type Layout =
  /**
   * ### Sidebar
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
  | 'sidebar'
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
  | 'topbar'
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
  | 'sidebar_left';

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
    <TimelineSection>
      <ErrorBoundary mini>
        <ReplayTimeline />
      </ErrorBoundary>
    </TimelineSection>
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

  if (layout === 'sidebar') {
    const sidebar = (
      <FluidPanel title={<SideTabs />} scroll={false}>
        <Sidebar showCrumbs={showCrumbs} showVideo={showVideo} />
      </FluidPanel>
    );
    return (
      <BodyContent>
        {timeline}
        <SplitPanel
          left={{
            content,
            default: '60%',
            min: {px: 300},
          }}
          right={{
            content: sidebar,
            default: '325px',
            min: {px: 325},
          }}
        />
      </BodyContent>
    );
  }

  if (layout === 'sidebar_left') {
    return (
      <Container>
        {timeline}
        <PageRow>
          <ResizePanel direction="e" minWidth={SIDEBAR_MIN_WIDTH}>
            <SidebarSection>
              <AsideTabsV2 showCrumbs={showCrumbs} showVideo={showVideo} />
            </SidebarSection>
          </ResizePanel>
          {content}
        </PageRow>
      </Container>
    );
  }

  // layout === 'topbar' or default
  return (
    <BodyContent>
      {timeline}
      <SplitPanel
        top={{
          content: (
            <TopbarSection>
              {video}
              {crumbs}
            </TopbarSection>
          ),
          default: '325px',
          min: {px: 325},
        }}
        bottom={{
          content,
          min: {px: 300},
        }}
      />
    </BodyContent>
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

// const SideTabs = styled('div')`
//   display: grid;
//   grid-template-rows: auto 1fr;
//   max-height: 100%;
// `;

export default ReplayLayout;
