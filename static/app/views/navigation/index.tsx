import {useEffect, useRef} from 'react';
import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';

import {Container, Flex} from '@sentry/scraps/layout';
import {ExternalLink} from '@sentry/scraps/link';

import {
  closeModal,
  openCommandPalette,
  openCommandPaletteDeprecated,
} from 'sentry/actionCreators/modal';
import {useGlobalCommandPaletteActions} from 'sentry/components/commandPalette/useGlobalCommandPaletteActions';
import {useGlobalModal} from 'sentry/components/globalModal/useGlobalModal';
import {t} from 'sentry/locale';
import {useHotkeys} from 'sentry/utils/useHotkeys';
import {useOrganization} from 'sentry/utils/useOrganization';
import {
  MobileNavigation,
  MobilePageFrameNavigation,
} from 'sentry/views/navigation/mobileNavigation';
import {Navigation as DesktopNavigation} from 'sentry/views/navigation/navigation';
import {
  NavigationTourProvider,
  useNavigationTour,
} from 'sentry/views/navigation/navigationTour';
import {PrimaryNavigation} from 'sentry/views/navigation/primary/components';
import {UserDropdown} from 'sentry/views/navigation/primary/userDropdown';
import {usePrimaryNavigation} from 'sentry/views/navigation/primaryNavigationContext';
import {useHasPageFrameFeature} from 'sentry/views/navigation/useHasPageFrameFeature';
import {useResetActiveNavigationGroup} from 'sentry/views/navigation/useResetActiveNavigationGroup';

function UserAndOrganizationNavigation() {
  const organization = useOrganization();
  const {layout} = usePrimaryNavigation();
  const {visible} = useGlobalModal();
  const hasPageFrame = useHasPageFrameFeature();

  useGlobalCommandPaletteActions();

  const commandPaletteOpenRef = useRef(false);

  useEffect(() => {
    if (!visible) {
      commandPaletteOpenRef.current = false;
    }
  }, [visible]);

  useHotkeys([
    {
      match: ['command+shift+p', 'command+k', 'ctrl+shift+p', 'ctrl+k'],
      includeInputs: true,
      callback: () => {
        if (organization.features.includes('cmd-k-supercharged')) {
          if (visible && commandPaletteOpenRef.current) {
            closeModal();
          } else if (!visible) {
            openCommandPalette();
            commandPaletteOpenRef.current = true;
          }
        } else if (!visible) {
          openCommandPaletteDeprecated();
        }
      },
    },
  ]);

  return (
    <NavigationLayout>
      {layout === 'mobile' ? (
        hasPageFrame ? (
          <MobilePageFrameNavigation />
        ) : (
          <MobileNavigation />
        )
      ) : (
        <DesktopNavigation />
      )}
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
  const {layout} = usePrimaryNavigation();
  const {currentStepId} = useNavigationTour();
  const hoverProps = useResetActiveNavigationGroup();

  return (
    <Flex
      top={0}
      left={0}
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
    // @TODO(JonasBadalic): When this page gets any content, we should add the skip link back in.
    return <UserOnlyNavigation />;
  }

  return (
    <NavigationTourProvider>
      <SkipLink />
      <UserAndOrganizationNavigation />
    </NavigationTourProvider>
  );
}

function SkipLink() {
  const theme = useTheme();
  const primaryNavigationContext = usePrimaryNavigation();

  if (primaryNavigationContext.layout === 'mobile') {
    return null;
  }

  return (
    <SkipLinkContainer
      padding="sm md"
      border="primary"
      background="primary"
      radius="md"
      position="absolute"
      left={theme.space.sm}
      whiteSpace="nowrap"
    >
      {p => (
        <ExternalLink {...p} href="#main" openInNewTab={false}>
          {t('Skip to main content')}
        </ExternalLink>
      )}
    </SkipLinkContainer>
  );
}

const SkipLinkContainer = styled(Container)`
  top: -100%;
  z-index: ${p => p.theme.zIndex.toast};

  &:focus-within {
    top: ${p => p.theme.space.sm};
  }
`;
