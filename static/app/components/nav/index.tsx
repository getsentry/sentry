import {css} from '@emotion/react';
import styled from '@emotion/styled';

import {useNavContext} from 'sentry/components/nav/context';
import MobileTopbar from 'sentry/components/nav/mobileTopbar';
import {Sidebar} from 'sentry/components/nav/sidebar';
import {
  NavigationTourProvider,
  useStackedNavigationTour,
} from 'sentry/components/nav/tour/tour';
import {NavLayout} from 'sentry/components/nav/types';

function NavContent() {
  const {layout, navParentRef} = useNavContext();
  const {currentStepId} = useStackedNavigationTour();
  const tourIsActive = currentStepId !== null;

  return (
    <NavContainer
      ref={navParentRef}
      tourIsActive={tourIsActive}
      isMobile={layout === NavLayout.MOBILE}
    >
      {layout === NavLayout.SIDEBAR ? <Sidebar /> : <MobileTopbar />}
    </NavContainer>
  );
}

function Nav() {
  return (
    <NavigationTourProvider>
      <NavContent />
    </NavigationTourProvider>
  );
}

const NavContainer = styled('div')<{isMobile: boolean; tourIsActive: boolean}>`
  display: flex;
  user-select: none;

  ${p =>
    !p.tourIsActive &&
    css`
      position: sticky;
      top: 0;
      z-index: ${p.theme.zIndex.sidebarPanel};
    `}

  ${p =>
    !p.isMobile &&
    css`
      bottom: 0;
      height: 100vh;
      height: 100dvh;
    `}
`;

export default Nav;
