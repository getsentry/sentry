import {useRef} from 'react';
import styled from '@emotion/styled';
import {mergeRefs} from '@react-aria/utils';
import {AnimatePresence, motion} from 'framer-motion';

import useResizable from 'sentry/utils/useResizable';
import {useSyncedLocalStorageState} from 'sentry/utils/useSyncedLocalStorageState';
import {
  NAVIGATION_SECONDARY_SIDEBAR_DATA_ATTRIBUTE,
  SECONDARY_SIDEBAR_MAX_WIDTH,
  SECONDARY_SIDEBAR_MIN_WIDTH,
  SECONDARY_SIDEBAR_WIDTH,
} from 'sentry/views/navigation/constants';
import {useNavigationContext} from 'sentry/views/navigation/navigationContext';
import {
  NAVIGATION_TOUR_CONTENT,
  NavigationTour,
  NavigationTourElement,
  useNavigationTour,
} from 'sentry/views/navigation/navigationTour';
import {SecondaryNavigation} from 'sentry/views/navigation/secondary/secondary';
import {SecondaryNavigationContent} from 'sentry/views/navigation/secondary/secondaryNavigationContent';

export function SecondarySidebar() {
  const {currentStepId} = useNavigationTour();
  const stepId = currentStepId ?? NavigationTour.ISSUES;
  const resizableContainerRef = useRef<HTMLDivElement>(null);
  const resizeHandleRef = useRef<HTMLDivElement>(null);

  const [secondarySidebarWidth, setSecondarySidebarWidth] = useSyncedLocalStorageState(
    'secondary-sidebar-width',
    SECONDARY_SIDEBAR_WIDTH
  );

  const {onMouseDown: handleStartResize, size} = useResizable({
    ref: resizableContainerRef,
    initialSize: secondarySidebarWidth,
    minWidth: SECONDARY_SIDEBAR_MIN_WIDTH,
    maxWidth: SECONDARY_SIDEBAR_MAX_WIDTH,
    onResizeEnd: newWidth => {
      setSecondarySidebarWidth(newWidth);
    },
  });

  const {activeNavigationGroup} = useNavigationContext();

  return (
    <SecondarySidebarWrapper
      id={stepId}
      description={NAVIGATION_TOUR_CONTENT[stepId].description}
      title={NAVIGATION_TOUR_CONTENT[stepId].title}
    >
      {({ref, ...props}) => (
        <ResizeWrapper
          {...props}
          ref={mergeRefs(resizableContainerRef, ref)}
          {...{
            [NAVIGATION_SECONDARY_SIDEBAR_DATA_ATTRIBUTE]: true,
          }}
        >
          <AnimatePresence mode="popLayout" initial={false}>
            <MotionDiv
              key={activeNavigationGroup}
              initial={{x: -6, opacity: 0}}
              animate={{x: 0, opacity: 1}}
              exit={{x: 6, opacity: 0}}
              transition={{duration: 0.06}}
            >
              <SecondarySidebarInner>
                <SecondaryNavigationContent group={activeNavigationGroup} />
              </SecondarySidebarInner>
              <ResizeHandle
                ref={resizeHandleRef}
                onMouseDown={handleStartResize}
                onDoubleClick={() => {
                  setSecondarySidebarWidth(SECONDARY_SIDEBAR_WIDTH);
                }}
                atMinWidth={size === SECONDARY_SIDEBAR_MIN_WIDTH}
                atMaxWidth={size === SECONDARY_SIDEBAR_MAX_WIDTH}
              />
            </MotionDiv>
          </AnimatePresence>
        </ResizeWrapper>
      )}
    </SecondarySidebarWrapper>
  );
}

const SecondarySidebarWrapper = styled(NavigationTourElement)`
  background: ${p => p.theme.tokens.background.secondary};
  border-right: 1px solid ${p => p.theme.tokens.border.primary};
  position: relative;
  z-index: ${p => p.theme.zIndex.sidebarPanel};
  height: 100%;
`;

const ResizeWrapper = styled('div')`
  right: 0;
  height: 100%;
  width: ${SECONDARY_SIDEBAR_WIDTH}px;
`;

const SecondarySidebarInner = styled(SecondaryNavigation)`
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
      background: ${p => p.theme.tokens.graphics.accent.vibrant};
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
