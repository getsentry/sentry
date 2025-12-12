import {useEffect} from 'react';
import {css} from '@emotion/react';
import styled from '@emotion/styled';

import {space} from 'sentry/styles/space';
import useOrganization from 'sentry/utils/useOrganization';
import {PRIMARY_SIDEBAR_WIDTH} from 'sentry/views/nav/constants';
import {useNavContext} from 'sentry/views/nav/context';
import MobileTopbar from 'sentry/views/nav/mobileTopbar';
import {Sidebar} from 'sentry/views/nav/sidebar';
import {
  NavigationTourProvider,
  useStackedNavigationTour,
} from 'sentry/views/nav/tour/tour';
import {NavLayout} from 'sentry/views/nav/types';
import {useCommandPalette} from 'sentry/views/nav/useCommandPalette';
import {UserDropdown} from 'sentry/views/nav/userDropdown';
import {useResetActiveNavGroup} from 'sentry/views/nav/useResetActiveNavGroup';

function NavContent() {
  useCommandPalette();
  const {layout, navParentRef} = useNavContext();
  const {currentStepId, endTour} = useStackedNavigationTour();
  const tourIsActive = currentStepId !== null;
  const hoverProps = useResetActiveNavGroup();

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
      {...hoverProps}
    >
      {layout === NavLayout.SIDEBAR ? <Sidebar /> : <MobileTopbar />}
    </NavContainer>
  );
}

function Nav() {
  const organization = useOrganization({allowNull: true});

  if (!organization) {
    return (
      <NoOrganizationSidebar data-test-id="no-organization-sidebar">
        <UserDropdown />
      </NoOrganizationSidebar>
    );
  }

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

const NoOrganizationSidebar = styled('div')`
  z-index: ${p => p.theme.zIndex.sidebarPanel};
  width: ${PRIMARY_SIDEBAR_WIDTH}px;
  padding: ${space(1.5)} 0 ${space(1)} 0;
  border-right: 1px solid ${p => p.theme.border};
  background: ${p => p.theme.tokens.background.primary};
  display: flex;
  align-items: center;
  flex-direction: column;
`;

export default Nav;
