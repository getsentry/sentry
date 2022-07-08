import ErrorBoundary from 'sentry/components/errorBoundary';
import ReplayTimeline from 'sentry/components/replays/breadcrumbs/replayTimeline';
import ReplayView from 'sentry/components/replays/replayView';
import useFullscreen from 'sentry/utils/replays/hooks/useFullscreen';
import Breadcrumbs from 'sentry/views/replays/detail/breadcrumbs';
import FocusArea from 'sentry/views/replays/detail/focusArea';
import FocusTabs from 'sentry/views/replays/detail/focusTabs';

import AsideTabsV2 from './asideTabs_v2';
import Container from './container';
import {
  BreadcrumbSection,
  ContentSection,
  PageRow,
  SIDEBAR_MIN_WIDTH,
  SidebarSection,
  TimelineSection,
  TOPBAR_MIN_HEIGHT,
  TopbarSection,
  VideoSection,
} from './pageSections';
import ResizePanel from './resizePanel';

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
    <ContentSection>
      <ErrorBoundary mini>
        <FocusTabs />
        <FocusArea />
      </ErrorBoundary>
    </ContentSection>
  );

  if (layout === 'sidebar') {
    return (
      <Container>
        {timeline}
        <PageRow>
          {content}
          <ResizePanel direction="w" minWidth={SIDEBAR_MIN_WIDTH}>
            <SidebarSection>
              <AsideTabsV2 showCrumbs={showCrumbs} showVideo={showVideo} />
            </SidebarSection>
          </ResizePanel>
        </PageRow>
      </Container>
    );
  }

  // layout === 'topbar' or default
  return (
    <Container>
      {timeline}
      <ResizePanel
        direction="s"
        minHeight={TOPBAR_MIN_HEIGHT}
        modifierClass="overlapDown"
      >
        <TopbarSection>
          {video}
          {crumbs}
        </TopbarSection>
      </ResizePanel>
      {content}
    </Container>
  );
}

export default ReplayLayout;
