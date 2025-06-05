import styled from '@emotion/styled';
import {AnimatePresence, motion} from 'framer-motion';

import {SECONDARY_SIDEBAR_WIDTH} from 'sentry/views/nav/constants';
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
  const {activePrimaryNavGroup} = useNavContext();
  const defaultActiveNavGroup = useActiveNavGroup();

  const activeNavGroup = activePrimaryNavGroup ?? defaultActiveNavGroup;

  return (
    <SecondarySidebarWrapper
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
        </MotionDiv>
      </AnimatePresence>
    </SecondarySidebarWrapper>
  );
}

const SecondarySidebarWrapper = styled(NavTourElement)`
  position: relative;
  border-right: 1px solid
    ${p => (p.theme.isChonk ? p.theme.border : p.theme.translucentGray200)};
  background: ${p => (p.theme.isChonk ? p.theme.background : p.theme.surface200)};
  width: ${SECONDARY_SIDEBAR_WIDTH}px;
  z-index: ${p => p.theme.zIndex.sidebarPanel};
  height: 100%;
`;

const SecondarySidebarInner = styled(SecondaryNav)`
  height: 100%;
`;

const MotionDiv = styled(motion.div)`
  height: 100%;
  width: 100%;
`;
