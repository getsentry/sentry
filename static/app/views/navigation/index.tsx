import {useTheme} from '@emotion/react';

import {Flex} from '@sentry/scraps/layout';

import {
  openCommandPalette,
  openCommandPaletteDeprecated,
} from 'sentry/actionCreators/modal';
import {useGlobalCommandPaletteActions} from 'sentry/components/commandPalette/useGlobalCommandPaletteActions';
import {useGlobalModal} from 'sentry/components/globalModal/useGlobalModal';
import {useHotkeys} from 'sentry/utils/useHotkeys';
import {useOrganization} from 'sentry/utils/useOrganization';
import {MobileNavigation} from 'sentry/views/navigation/mobileNavigation';
import {Navigation as DesktopNavigation} from 'sentry/views/navigation/navigation';
import {
  NavigationContextProvider,
  useNavigation,
} from 'sentry/views/navigation/navigationContext';
import {
  NavigationTourProvider,
  useNavigationTour,
} from 'sentry/views/navigation/navigationTour';
import {PrimaryNavigation} from 'sentry/views/navigation/primary/components';
import {UserDropdown} from 'sentry/views/navigation/primary/userDropdown';
import {useResetActiveNavigationGroup} from 'sentry/views/navigation/useResetActiveNavigationGroup';

function UserAndOrganizationNavigation() {
  const organization = useOrganization();
  const {layout} = useNavigation();
  const {visible} = useGlobalModal();

  useGlobalCommandPaletteActions();

  useHotkeys(
    visible
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

  return (
    <NavigationLayout>
      {layout === 'sidebar' ? <DesktopNavigation /> : <MobileNavigation />}
    </NavigationLayout>
  );
}

function UserOnlyNavigation() {
  return (
    <PrimaryNavigation.Sidebar data-test-id="no-organization-sidebar">
      <UserDropdown />
    </PrimaryNavigation.Sidebar>
  );
}

function NavigationLayout({children}: {children: React.ReactNode}) {
  const theme = useTheme();
  const {layout} = useNavigation();
  const {currentStepId} = useNavigationTour();
  const hoverProps = useResetActiveNavigationGroup();

  return (
    <Flex
      top={0}
      position={currentStepId ? undefined : 'sticky'}
      bottom={layout === 'mobile' ? undefined : 0}
      height={layout === 'mobile' ? undefined : '100dvh'}
      style={{
        zIndex: currentStepId ? undefined : theme.zIndex.sidebarPanel,
        userSelect: 'none',
      }}
      {...hoverProps}
    >
      {children}
    </Flex>
  );
}

export function Navigation() {
  const organization = useOrganization({allowNull: true});

  if (!organization) {
    return <UserOnlyNavigation />;
  }

  return (
    <NavigationContextProvider>
      <NavigationTourProvider>
        <UserAndOrganizationNavigation />
      </NavigationTourProvider>
    </NavigationContextProvider>
  );
}
