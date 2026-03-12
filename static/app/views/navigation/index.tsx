import {useEffect} from 'react';
import {useTheme} from '@emotion/react';

import {Flex} from '@sentry/scraps/layout';

import {
  openCommandPalette,
  openCommandPaletteDeprecated,
} from 'sentry/actionCreators/modal';
import {useGlobalCommandPaletteActions} from 'sentry/components/commandPalette/useGlobalCommandPaletteActions';
import {useGlobalModal} from 'sentry/components/globalModal/useGlobalModal';
import {useHotkeys} from 'sentry/utils/useHotkeys';
import useOrganization from 'sentry/utils/useOrganization';
import {PRIMARY_SIDEBAR_WIDTH} from 'sentry/views/navigation/constants';
import {MobileNavigation} from 'sentry/views/navigation/mobileNavigation';
import {Navigation as DesktopNavigation} from 'sentry/views/navigation/navigation';
import {useNavigationContext} from 'sentry/views/navigation/navigationContext';
import {
  NavigationTourProvider,
  useNavigationTour,
} from 'sentry/views/navigation/navigationTour';
import {UserDropdown} from 'sentry/views/navigation/primary/userDropdown';
import {useResetActiveNavigationGroup} from 'sentry/views/navigation/useResetActiveNavigationGroup';

function UserAndOrganizationNavigation() {
  const theme = useTheme();
  const {layout, navigationParentRef} = useNavigationContext();
  const {currentStepId, endTour} = useNavigationTour();
  const tourIsActive = currentStepId !== null;
  const hoverProps = useResetActiveNavigationGroup();

  const organization = useOrganization();
  const {visible: isModalOpen} = useGlobalModal();
  useGlobalCommandPaletteActions();

  useHotkeys(
    isModalOpen
      ? []
      : [
          {
            match: ['command+shift+p', 'command+k', 'ctrl+shift+p', 'ctrl+k'],
            callback: () => {
              if (organization.features.includes('cmd-k-supercharged')) {
                openCommandPalette();
              } else {
                openCommandPaletteDeprecated();
              }
            },
          },
        ]
  );

  // The tour only works with the sidebar layout, so if we change to the mobile
  // layout in the middle of the tour, it needs to end.
  useEffect(() => {
    if (tourIsActive && layout === 'mobile') {
      endTour();
    }
  }, [endTour, layout, tourIsActive]);

  return (
    <Flex
      ref={navigationParentRef}
      top={0}
      position={tourIsActive ? undefined : 'sticky'}
      bottom={layout === 'mobile' ? undefined : 0}
      height={layout === 'mobile' ? undefined : '100dvh'}
      style={{
        zIndex: tourIsActive ? undefined : theme.zIndex.sidebarPanel,
        userSelect: 'none',
      }}
      {...hoverProps}
    >
      {layout === 'sidebar' ? <DesktopNavigation /> : <MobileNavigation />}
    </Flex>
  );
}

function UserOnlyNavigation() {
  const theme = useTheme();
  return (
    <Flex
      data-test-id="no-organization-sidebar"
      width={`${PRIMARY_SIDEBAR_WIDTH}px`}
      padding="lg 0 md 0"
      borderRight="primary"
      background="primary"
      direction="column"
      align="center"
      justify="between"
      style={{zIndex: theme.zIndex.sidebarPanel}}
    >
      <Flex direction="column" gap="md" justify="between">
        <UserDropdown />
      </Flex>
    </Flex>
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
