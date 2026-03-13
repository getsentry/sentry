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
import {PRIMARY_SIDEBAR_WIDTH} from 'sentry/views/navigation/constants';
import {MobileNavigation} from 'sentry/views/navigation/mobileNavigation';
import {Navigation as DesktopNavigation} from 'sentry/views/navigation/navigation';
import {useNavigation} from 'sentry/views/navigation/navigationContext';
import {useNavigationTour} from 'sentry/views/navigation/navigationTour';
import {UserDropdown} from 'sentry/views/navigation/primary/userDropdown';
import {useResetActiveNavigationGroup} from 'sentry/views/navigation/useResetActiveNavigationGroup';

function UserAndOrganizationNavigation() {
  const theme = useTheme();
  const organization = useOrganization();
  const {layout} = useNavigation();
  const {visible} = useGlobalModal();

  const {currentStepId} = useNavigationTour();
  const hoverProps = useResetActiveNavigationGroup();

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

  return <UserAndOrganizationNavigation />;
}
