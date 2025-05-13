import {useRef} from 'react';
import styled from '@emotion/styled';

import useResizable from 'sentry/utils/useResizable';
import {
  SECONDARY_SIDEBAR_MAX_WIDTH,
  SECONDARY_SIDEBAR_MIN_WIDTH,
  SECONDARY_SIDEBAR_WIDTH,
} from 'sentry/views/nav/constants';
import {useNavContext} from 'sentry/views/nav/context';
import {
  NavTourElement,
  STACKED_NAVIGATION_TOUR_CONTENT,
  StackedNavigationTour,
  useStackedNavigationTour,
} from 'sentry/views/nav/tour/tour';

export function SecondarySidebar() {
  const {setSecondaryNavEl} = useNavContext();
  const {currentStepId} = useStackedNavigationTour();
  const stepId = currentStepId ?? StackedNavigationTour.ISSUES;
  const resizableContainerRef = useRef<HTMLDivElement>(null);
  const resizeHandleRef = useRef<HTMLDivElement>(null);

  const {
    onMouseDown: handleStartResize,
    size,
    onDoubleClick,
  } = useResizable({
    ref: resizableContainerRef,
    initialSize: SECONDARY_SIDEBAR_WIDTH,
    minWidth: SECONDARY_SIDEBAR_MIN_WIDTH,
    maxWidth: SECONDARY_SIDEBAR_MAX_WIDTH,
    sizeStorageKey: 'secondary-sidebar-width',
  });

  return (
    <ResizeWrapper ref={resizableContainerRef} onMouseDown={handleStartResize}>
      <NavTourElement
        id={stepId}
        description={STACKED_NAVIGATION_TOUR_CONTENT[stepId].description}
        title={STACKED_NAVIGATION_TOUR_CONTENT[stepId].title}
      >
        <SecondarySidebarInner
          ref={setSecondaryNavEl}
          role="navigation"
          aria-label="Secondary Navigation"
        />
        <ResizeHandle
          ref={resizeHandleRef}
          onMouseDown={handleStartResize}
          onDoubleClick={onDoubleClick}
          atMinWidth={size === SECONDARY_SIDEBAR_MIN_WIDTH}
          atMaxWidth={size === SECONDARY_SIDEBAR_MAX_WIDTH}
        />
      </NavTourElement>
    </ResizeWrapper>
  );
}

const ResizeWrapper = styled('div')`
  position: relative;
  right: 0;
  border-right: 1px solid
    ${p => (p.theme.isChonk ? p.theme.border : p.theme.translucentGray200)};
  background: ${p => (p.theme.isChonk ? p.theme.background : p.theme.surface200)};
  z-index: ${p => p.theme.zIndex.sidebarPanel};
  height: 100%;
`;

const SecondarySidebarInner = styled('div')`
  display: grid;
  grid-template-rows: auto 1fr auto;
  height: 100%;
`;

const ResizeHandle = styled('div')<{atMaxWidth: boolean; atMinWidth: boolean}>`
  position: absolute;
  right: 0px;
  top: 0;
  bottom: 0;
  width: 8px;
  border-radius: 8px;
  z-index: ${p => p.theme.zIndex.drawer + 2};
  cursor: ${p => (p.atMinWidth ? 'e-resize' : p.atMaxWidth ? 'w-resize' : 'ew-resize')};

  &:hover,
  &:active {
    &::after {
      background: ${p => p.theme.purple400};
    }
  }

  &::after {
    content: '';
    position: absolute;
    right: -2px;
    top: 0;
    bottom: 0;
    width: 4px;
    opacity: 0.8;
    background: transparent;
    transition: background 0.25s ease 0.1s;
  }
`;
