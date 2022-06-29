import styled from '@emotion/styled';

import ErrorBoundary from 'sentry/components/errorBoundary';
import ReplayTimeline from 'sentry/components/replays/breadcrumbs/replayTimeline';
import ReplayView from 'sentry/components/replays/replayView';
import space from 'sentry/styles/space';
import useFullscreen from 'sentry/utils/replays/hooks/useFullscreen';
import Breadcrumbs from 'sentry/views/replays/detail/breadcrumbs';
import FocusArea from 'sentry/views/replays/detail/focusArea';
import FocusTabs from 'sentry/views/replays/detail/focusTabs';

import Container from './container';
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

const SIDEBAR_MIN_WIDTH = 325;
const TOPBAR_MIN_HEIGHT = 325;

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
              {video ? <ResizePanel direction="s">{video}</ResizePanel> : null}
              {crumbs}
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

const PageColumn = styled('section')`
  display: flex;
  flex-grow: 1;
  flex-wrap: nowrap;
  flex-direction: column;
`;

const PageRow = styled(PageColumn)`
  flex-direction: row;
`;

const TimelineSection = styled(PageColumn)`
  flex-grow: 0;
`;

const ContentSection = styled(PageColumn)`
  flex-grow: 3; /* Higher growth than SidebarSection or TopVideoSection */

  height: 100%;
  min-height: 300px;
  width: 100%;
`;

const VideoSection = styled(PageColumn)`
  flex-grow: 2;
`;

const BreadcrumbSection = styled(PageColumn)``;

const SidebarSection = styled(PageColumn)`
  min-width: ${SIDEBAR_MIN_WIDTH}px;
`;

const TopbarSection = styled(PageRow)`
  height: ${TOPBAR_MIN_HEIGHT}px;
  min-height: ${TOPBAR_MIN_HEIGHT}px;

  ${BreadcrumbSection} {
    max-width: ${SIDEBAR_MIN_WIDTH}px;
    margin-left: ${space(2)};
  }
`;

export default ReplayLayout;
