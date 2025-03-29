import styled from '@emotion/styled';

import {SECONDARY_SIDEBAR_WIDTH} from 'sentry/views/nav/constants';
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

  return (
    <SecondarySidebarWrapper
      id={stepId}
      description={STACKED_NAVIGATION_TOUR_CONTENT[stepId].description}
      title={STACKED_NAVIGATION_TOUR_CONTENT[stepId].title}
    >
      <SecondarySidebarInner
        ref={setSecondaryNavEl}
        role="navigation"
        aria-label="Secondary Navigation"
      />
    </SecondarySidebarWrapper>
  );
}

const SecondarySidebarWrapper = styled(NavTourElement)`
  position: relative;
  border-right: 1px solid ${p => p.theme.translucentGray200};
  background: ${p => p.theme.surface200};
  width: ${SECONDARY_SIDEBAR_WIDTH}px;
  z-index: ${p => p.theme.zIndex.sidebarPanel};
  height: 100%;
`;

const SecondarySidebarInner = styled('div')`
  display: grid;
  grid-template-rows: auto 1fr auto;
  height: 100%;
`;
