import {
  openCommandPalette,
  openCommandPaletteDeprecated,
} from 'sentry/actionCreators/modal';
import {useGlobalCommandPaletteActions} from 'sentry/components/commandPalette/useGlobalCommandPaletteActions';
import {useGlobalModal} from 'sentry/components/globalModal/useGlobalModal';
import {useHotkeys} from 'sentry/utils/useHotkeys';
import useOrganization from 'sentry/utils/useOrganization';
import {PrimaryNavigation} from 'sentry/views/navigation/components/primary';
import {MobileNavigation} from 'sentry/views/navigation/mobileNavigation';
import {Navigation as DesktopNavigation} from 'sentry/views/navigation/navigation';
import {useNavigationContext} from 'sentry/views/navigation/navigationContext';
import {NavigationTourProvider} from 'sentry/views/navigation/navigationTour';
import {UserDropdown} from 'sentry/views/navigation/primary/userDropdown';
import {NavigationLayout} from 'sentry/views/navigation/types';

function useNavigationCommandPalette() {
  const organization = useOrganization();
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
}

function UserAndOrganizationNavigation() {
  useNavigationCommandPalette();
  const {layout} = useNavigationContext();

  if (layout === NavigationLayout.MOBILE) {
    return <MobileNavigation />;
  }

  return <DesktopNavigation />;
}

function UserOnlyNavigation() {
  useNavigationCommandPalette();

  // @TODO(JonasBadalic): Improve the UX of this case
  return (
    <PrimaryNavigation>
      <PrimaryNavigation.Header>
        <UserDropdown />
      </PrimaryNavigation.Header>
    </PrimaryNavigation>
  );
}

export function Navigation() {
  const organization = useOrganization({allowNull: true});

  if (!organization) {
    return (
      <NavigationTourProvider>
        <UserOnlyNavigation />
      </NavigationTourProvider>
    );
  }

  return (
    <NavigationTourProvider>
      <UserAndOrganizationNavigation />
    </NavigationTourProvider>
  );
}
