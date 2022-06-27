import BaseResizePanel from 'react-resize-panel';
import styled from '@emotion/styled';

import ErrorBoundary from 'sentry/components/errorBoundary';
import ReplayTimeline from 'sentry/components/replays/breadcrumbs/replayTimeline';
import ReplayView from 'sentry/components/replays/replayView';
import space from 'sentry/styles/space';
import useFullscreen from 'sentry/utils/replays/hooks/useFullscreen';
import theme from 'sentry/utils/theme';

import Breadcrumbs from './breadcrumbs';
import FocusArea from './focusArea';
import FocusTabs from './focusTabs';

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

const GrabberColor = encodeURIComponent(theme.gray300);
const GrabberSVG = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16' fill='${GrabberColor}' height='16px' width='16px'%3E%3Ccircle cx='4.73' cy='8' r='1.31'%3E%3C/circle%3E%3Ccircle cx='4.73' cy='1.31' r='1.31'%3E%3C/circle%3E%3Ccircle cx='11.27' cy='8' r='1.31'%3E%3C/circle%3E%3Ccircle cx='11.27' cy='1.31' r='1.31'%3E%3C/circle%3E%3Ccircle cx='4.73' cy='14.69' r='1.31'%3E%3C/circle%3E%3Ccircle cx='11.27' cy='14.69' r='1.31'%3E%3C/circle%3E%3C/svg%3E")`;

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
  padding: ${space(2)};

  .resizeWidthBar {
    cursor: ew-resize;
    height: 100%;
    width: ${space(2)};
  }

  .resizeHeightBar {
    cursor: ns-resize;
    height: ${space(2)};
    width: 100%;
  }
  .resizeHeightBar.overlapDown {
    height: calc(16px + 34px); /* Spacing between components + height of <FocusTabs> */
    margin-bottom: -34px; /* The height of the <FocusTabs> text + border */
    z-index: ${p => p.theme.zIndex.initial};
  }

  .resizeWidthBar,
  .resizeHeightBar {
    background: transparent;
    display: flex;
    align-items: center;
    align-content: center;
    justify-content: center;
  }
  .resizeWidthBar:hover,
  .resizeHeightBar:hover {
    background: ${p => p.theme.hover};
  }

  .resizeWidthHandle {
    height: ${space(3)};
    width: ${space(2)};
  }

  .resizeHeightHandle {
    height: ${space(2)};
    width: ${space(3)};
    transform: rotate(90deg);
  }

  .resizeWidthHandle > span,
  .resizeHeightHandle > span {
    display: block;
    background: transparent ${GrabberSVG} center center no-repeat;
    width: 100%;
    height: 100%;
  }
`;

type ResizePanelProps = {
  direction: 'n' | 'e' | 's' | 'w';
  minHeight?: number;
  minWidth?: number;
  modifierClass?: string;
};

const ResizePanel = styled(
  ({direction, modifierClass = '', ...props}: ResizePanelProps) => {
    const movesUpDown = ['n', 's'].includes(direction);
    const borderClass = movesUpDown ? 'resizeHeightBar' : 'resizeWidthBar';
    const handleClass = movesUpDown ? 'resizeHeightHandle' : 'resizeWidthHandle';

    return (
      <BaseResizePanel
        direction={direction}
        {...props}
        borderClass={`${borderClass} ${modifierClass}`}
        handleClass={`${handleClass} ${modifierClass}`}
      />
    );
  }
)`
  position: relative;
`;

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
  height: 325px;
  min-height: 325px;

  ${BreadcrumbSection} {
    max-width: 325px;
    margin-left: ${space(2)};
  }
`;

export default ReplayLayout;
