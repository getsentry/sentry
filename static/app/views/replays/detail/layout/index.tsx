import styled from '@emotion/styled';

import ErrorBoundary from 'sentry/components/errorBoundary';
import ReplayTimeline from 'sentry/components/replays/breadcrumbs/replayTimeline';
import ReplayView from 'sentry/components/replays/replayView';
import space from 'sentry/styles/space';
import useFullscreen from 'sentry/utils/replays/hooks/useFullscreen';
import Breadcrumbs from 'sentry/views/replays/detail/breadcrumbs';
import FocusArea from 'sentry/views/replays/detail/focusArea';
import FocusTabs from 'sentry/views/replays/detail/focusTabs';
import SplitPanel from 'sentry/views/replays/detail/layout/splitPanel';

import AsideTabsV2 from './asideTabs_v2';
import {
  BreadcrumbSection,
  TimelineSection,
  TopbarSection,
  VideoSection,
} from './pageSections';

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
    <BreadcrumbSection>
      <ErrorBoundary mini>
        <Breadcrumbs />
      </ErrorBoundary>
    </BreadcrumbSection>
  ) : null;

  const content = (
    <ErrorBoundary mini>
      <FocusTabs />
      <FocusArea />
    </ErrorBoundary>
  );

  if (layout === 'sidebar') {
    const sidebar = (
      <ErrorBoundary mini>
        <AsideTabsV2 showCrumbs={showCrumbs} showVideo={showVideo} />
      </ErrorBoundary>
    );
    return (
      <Container>
        {timeline}
        <SplitPanel
          left={{
            content,
            min: {px: 300},
          }}
          right={{
            content: sidebar,
            default: '325px',
            min: {px: 325},
          }}
        />
      </Container>
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
    <Container>
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
    </Container>
  );
}

const Container = styled('div')`
  width: 100%;
  height: 100%;
  max-height: 100%;
  display: flex;
  flex-flow: nowrap column;
  overflow: hidden;
  padding: ${space(2)};
`;

export default ReplayLayout;
