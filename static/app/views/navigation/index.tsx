import {useEffect} from 'react';
import {css} from '@emotion/react';
import styled from '@emotion/styled';

import {Flex} from '@sentry/scraps/layout';

import useOrganization from 'sentry/utils/useOrganization';
import {PRIMARY_SIDEBAR_WIDTH} from 'sentry/views/navigation/constants';
import {useNavigationContext} from 'sentry/views/navigation/context';
import MobileTopbar from 'sentry/views/navigation/mobileTopbar';
import {Sidebar} from 'sentry/views/navigation/sidebar';
import {
  NavigationTourProvider,
  useStackedNavigationTour,
} from 'sentry/views/navigation/tour/tour';
import {NavigationLayout} from 'sentry/views/navigation/types';
import {useCommandPalette} from 'sentry/views/navigation/useCommandPalette';
import {UserDropdown} from 'sentry/views/navigation/userDropdown';
import {useResetActiveNavigationGroup} from 'sentry/views/navigation/useResetActiveNavigationGroup';

function UserAndOrganizationNavigation() {
  useCommandPalette();
  const {layout, navigationParentRef} = useNavigationContext();
  const {currentStepId, endTour} = useStackedNavigationTour();
  const tourIsActive = currentStepId !== null;
  const hoverProps = useResetActiveNavigationGroup();

  // The tour only works with the sidebar layout, so if we change to the mobile
  // layout in the middle of the tour, it needs to end.
  useEffect(() => {
    if (tourIsActive && layout === NavigationLayout.MOBILE) {
      endTour();
    }
  }, [endTour, layout, tourIsActive]);

  return (
    <NavigationContainer
      ref={navigationParentRef}
      tourIsActive={tourIsActive}
      isMobile={layout === NavigationLayout.MOBILE}
      {...hoverProps}
    >
      {layout === NavigationLayout.SIDEBAR ? <Sidebar /> : <MobileTopbar />}
    </NavigationContainer>
  );
}

function UserOnlyNavigation() {
  return (
    <NoOrganizationSidebar data-test-id="no-organization-sidebar">
      <Flex direction="column" gap="md" justify="between">
        <UserDropdown />
      </Flex>
    </NoOrganizationSidebar>
  );
}

export function Navigation() {
  const organization = useOrganization({allowNull: true});

  if (!organization) {
    return <UserOnlyNavigation />;
  }

  return (
    <NavigationTourProvider>
      <UserAndOrganizationNavigation />
    </NavigationTourProvider>
  );
}

const NavigationContainer = styled('div')<{isMobile: boolean; tourIsActive: boolean}>`
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
  padding: ${p => p.theme.space.lg} 0 ${p => p.theme.space.md} 0;
  border-right: 1px solid ${p => p.theme.tokens.border.primary};
  background: ${p => p.theme.tokens.background.primary};
  display: flex;
  align-items: center;
  flex-direction: column;
`;
