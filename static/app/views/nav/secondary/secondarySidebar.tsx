import {useRef} from 'react';
import styled from '@emotion/styled';
import {AnimatePresence, motion} from 'framer-motion';

import useResizable from 'sentry/utils/useResizable';
import {useSyncedLocalStorageState} from 'sentry/utils/useSyncedLocalStorageState';
import {
  SECONDARY_SIDEBAR_MAX_WIDTH,
  SECONDARY_SIDEBAR_MIN_WIDTH,
  SECONDARY_SIDEBAR_WIDTH,
} from 'sentry/views/nav/constants';
import {useNavContext} from 'sentry/views/nav/context';
import {SecondaryNav} from 'sentry/views/nav/secondary/secondary';
import {SecondaryNavContent} from 'sentry/views/nav/secondary/secondaryNavContent';
import {
  NavTourElement,
  STACKED_NAVIGATION_TOUR_CONTENT,
  StackedNavigationTour,
  useStackedNavigationTour,
} from 'sentry/views/nav/tour/tour';
import {useActiveNavGroup} from 'sentry/views/nav/useActiveNavGroup';

export function SecondarySidebar() {
  const {currentStepId} = useStackedNavigationTour();
  const stepId = currentStepId ?? StackedNavigationTour.ISSUES;
  const resizableContainerRef = useRef<HTMLDivElement>(null);
  const resizeHandleRef = useRef<HTMLDivElement>(null);

  const [secondarySidebarWidth, setSecondarySidebarWidth] = useSyncedLocalStorageState(
    'secondary-sidebar-width',
    SECONDARY_SIDEBAR_WIDTH
  );

  const {
    onMouseDown: handleStartResize,
    size,
    onDoubleClick,
  } = useResizable({
    ref: resizableContainerRef,
    initialSize: secondarySidebarWidth,
    minWidth: SECONDARY_SIDEBAR_MIN_WIDTH,
    maxWidth: SECONDARY_SIDEBAR_MAX_WIDTH,
    onResizeEnd: newWidth => {
      setSecondarySidebarWidth(newWidth);
    },
  });

  const {activePrimaryNavGroup} = useNavContext();
  const defaultActiveNavGroup = useActiveNavGroup();

  const activeNavGroup = activePrimaryNavGroup ?? defaultActiveNavGroup;

  return (
    <ResizeWrapper ref={resizableContainerRef} onMouseDown={handleStartResize}>
      <NavTourElement
        id={stepId}
        description={STACKED_NAVIGATION_TOUR_CONTENT[stepId].description}
        title={STACKED_NAVIGATION_TOUR_CONTENT[stepId].title}
      >
        <AnimatePresence mode="wait" initial={false}>
          <MotionDiv
            key={activeNavGroup}
            initial={{x: -4, opacity: 0}}
            animate={{x: 0, opacity: 1}}
            exit={{x: 4, opacity: 0}}
            transition={{duration: 0.06}}
          >
            <SecondarySidebarInner>
              <SecondaryNavContent group={activeNavGroup} />
            </SecondarySidebarInner>
            <ResizeHandle
              ref={resizeHandleRef}
              onMouseDown={handleStartResize}
              onDoubleClick={onDoubleClick}
              atMinWidth={size === SECONDARY_SIDEBAR_MIN_WIDTH}
              atMaxWidth={size === SECONDARY_SIDEBAR_MAX_WIDTH}
            />
          </MotionDiv>
        </AnimatePresence>
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
  width: ${SECONDARY_SIDEBAR_WIDTH}px;
`;

const SecondarySidebarInner = styled(SecondaryNav)`
  height: 100%;
`;

const MotionDiv = styled(motion.div)`
  height: 100%;
  width: 100%;
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
