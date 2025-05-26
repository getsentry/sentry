import {useEffect} from 'react';
import {css} from '@emotion/react';
import styled from '@emotion/styled';

import {useNavContext} from 'sentry/views/nav/context';
import MobileTopbar from 'sentry/views/nav/mobileTopbar';
import {SecondaryNav} from 'sentry/views/nav/secondary/secondary';
import {SecondaryNavContent} from 'sentry/views/nav/secondary/secondaryNavContent';
import {Sidebar} from 'sentry/views/nav/sidebar';
import {
  NavigationTourProvider,
  useStackedNavigationTour,
} from 'sentry/views/nav/tour/tour';
import {NavLayout} from 'sentry/views/nav/types';
import {useActiveNavGroup} from 'sentry/views/nav/useActiveNavGroup';

function NavContent() {
  const {layout, navParentRef} = useNavContext();
  const {currentStepId, endTour} = useStackedNavigationTour();
  const tourIsActive = currentStepId !== null;
  const activeNavGroup = useActiveNavGroup();

  // The tour only works with the sidebar layout, so if we change to the mobile
  // layout in the middle of the tour, it needs to end.
  useEffect(() => {
    if (tourIsActive && layout === NavLayout.MOBILE) {
      endTour();
    }
  }, [endTour, layout, tourIsActive]);

  return (
    <NavContainer
      ref={navParentRef}
      tourIsActive={tourIsActive}
      isMobile={layout === NavLayout.MOBILE}
    >
      {layout === NavLayout.SIDEBAR ? <Sidebar /> : <MobileTopbar />}
      <SecondaryNav>
        <SecondaryNavContent group={activeNavGroup} />
      </SecondaryNav>
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
