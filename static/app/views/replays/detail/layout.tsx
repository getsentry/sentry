import ResizePanel from 'react-resize-panel';
import styled from '@emotion/styled';

import ErrorBoundary from 'sentry/components/errorBoundary';
import ReplayTimeline from 'sentry/components/replays/breadcrumbs/replayTimeline';
import ReplayView from 'sentry/components/replays/replayView';
import space from 'sentry/styles/space';
import useFullscreen from 'sentry/utils/replays/hooks/useFullscreen';

import Breadcrumbs from './breadcrumbs';
import FocusArea from './focusArea';
import FocusTabs from './focusTabs';

type Layout =
  /**
   * ### Sidebar
   * ┌─────────────────────────┐
   * │ Timeline                │
   * ├──────────────┬──────────┤
   * │ Details      > Crumbs   │
   * │              >          │
   * │              >          │
   * │              >          │
   * │              >          │
   * └──────────────┴──────────┘
   * ### Sidebar + video=hide
   * ┌─────────────────────────┐
   * │ Timeline                │
   * ├──────────────┬──────────┤
   * │ Details      > Video    │
   * │              >          │
   * │              >─^^^^^^^^^┤
   * │              > Crumbs   │
   * │              >          │
   * └──────────────┴──────────┘
   */
  | 'sidebar'
  /**
   * ### Topbar
   *┌──────────────────────────┐
   *│ Timeline                 │
   *├────────────┬─────────────┤
   *│ Video      │ Breadcrumbs │
   *│            │             │
   *├^^^^^^^^^^^^^^^^^^^^^^^^^^┤
   *│ Details                  │
   *│                          │
   *└──────────────────────────┘
   *### Topbar + video=hide
   *┌──────────────────────────┐
   *│ Timeline                 │
   *│                          │
   *├──────────────────────────┤
   *│ Breadcrumbs              │
   *├^^^^^^^^^^^^^^^^^^^^^^^^^^┤
   *│ Details                  │
   *│                          │
   *└──────────────────────────┘
   */
  | 'topbar';

const SIDEBAR_MIN_WIDTH = 325;
const TOPBAR_MIN_HEIGHT = 325;

type Props = {
  layout: Layout;
  showCrumbs?: boolean;
  showTimeline?: boolean;
  showVideo?: boolean;
  // eventSlug: string;
  // orgId: string;
  // event?: Event;
};

function ReplayLayout({
  layout,
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

  switch (layout) {
    case 'sidebar':
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
    case 'topbar':
      return (
        <Container>
          {timeline}
          <ResizePanel direction="s" minHeight={TOPBAR_MIN_HEIGHT}>
            <TopbarSection>
              {video}
              {crumbs}
            </TopbarSection>
          </ResizePanel>
          {content}
        </Container>
      );
    default:
      return <div>TODO</div>;
  }
}

const Container = styled('div')`
  width: 100%;
  height: 100%;
  max-height: 100%;
  display: flex;
  flex-flow: nowrap column;
  overflow: hidden;

  padding: ${space(2)} ${space(2)} 0 ${space(2)};
  margin-bottom: ${space(2)};
  gap: ${space(2)};
`;

const PageColumn = styled('section')`
  display: flex;
  flex-grow: 1;
  flex-wrap: nowrap;
  flex-direction: column;
  gap: ${space(2)};
`;

const PageRow = styled(PageColumn)`
  flex-direction: row;
`;

const TimelineSection = styled(PageColumn)`
  flex-grow: 0;

  /* TODO(replay): Remove the bottom-margin from the <Panel> inside <ReplayTimeline> */
  margin-bottom: -${space(1)};
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
  height: 325px;
  min-height: 325px;

  ${BreadcrumbSection} {
    max-width: 325px;
  }
`;

export default ReplayLayout;
