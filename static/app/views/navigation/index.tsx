import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';

import {useHotkeys} from '@sentry/scraps/hotkey';
import {Container, Flex} from '@sentry/scraps/layout';
import {ExternalLink} from '@sentry/scraps/link';
import {useModal} from '@sentry/scraps/modal';

import {GlobalCommandPaletteActions} from 'sentry/components/commandPalette/ui/commandPaletteGlobalActions';
import {CommandPaletteSlot} from 'sentry/components/commandPalette/ui/commandPaletteSlot';
import {CommandPaletteHotkeys} from 'sentry/components/commandPalette/ui/commandPaletteStateContext';
import {t} from 'sentry/locale';
import {HoverOverlayGroupProvider} from 'sentry/utils/useHoverOverlay';
import {useOrganization} from 'sentry/utils/useOrganization';
import {MobileNavigation} from 'sentry/views/navigation/mobileNavigation';
import {Navigation as DesktopNavigation} from 'sentry/views/navigation/navigation';
import {
  NavigationTourProvider,
  useNavigationTour,
} from 'sentry/views/navigation/navigationTour';
import {PrimaryNavigation} from 'sentry/views/navigation/primary/components';
import {UserDropdown} from 'sentry/views/navigation/primary/userDropdown';
import {usePrimaryNavigation} from 'sentry/views/navigation/primaryNavigationContext';
import {
  MobileSecondaryNavigationContextProvider,
  useSecondaryNavigation,
} from 'sentry/views/navigation/secondaryNavigationContext';
import {useResetActiveNavigationGroup} from 'sentry/views/navigation/useResetActiveNavigationGroup';
import {useTopOffset} from 'sentry/views/navigation/useTopOffset';

/**
 * Renders the CMDK slot outlet elements in task → page → global DOM order so
 * that presortBySlotRef's compareDocumentPosition sorting works correctly.
 * Keeping these in the navigation (rather than in CommandPaletteProvider)
 * means they only exist when the full nav is mounted — tests that assert an
 * empty container are unaffected.
 */
function CommandPaletteSlotOutlets() {
  return (
    <div style={{display: 'none'}}>
      <CommandPaletteSlot.Outlet name="task">
        {p => <div {...p} />}
      </CommandPaletteSlot.Outlet>
      <CommandPaletteSlot.Outlet name="page">
        {p => <div {...p} />}
      </CommandPaletteSlot.Outlet>
      <CommandPaletteSlot.Outlet name="global">
        {p => <div {...p} />}
      </CommandPaletteSlot.Outlet>
    </div>
  );
}

function UserAndOrganizationNavigation({pageBannerHeight}: NavigationProps) {
  const {layout} = usePrimaryNavigation();
  const {visible} = useModal();
  const {view, setView} = useSecondaryNavigation();

  useHotkeys(
    visible
      ? []
      : [
          {
            match: 'mod+b',
            callback: () => setView(view === 'expanded' ? 'collapsed' : 'expanded'),
          },
        ]
  );

  return (
    <NavigationLayout pageBannerHeight={pageBannerHeight}>
      <CommandPaletteHotkeys />
      <CommandPaletteSlotOutlets />
      <GlobalCommandPaletteActions />
      {layout === 'mobile' ? (
        <MobileSecondaryNavigationContextProvider>
          <MobileNavigation />
        </MobileSecondaryNavigationContextProvider>
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

interface NavigationProps {
  pageBannerHeight?: number;
}

function NavigationLayout({
  children,
  pageBannerHeight = 0,
}: NavigationProps & {children: React.ReactNode}) {
  const theme = useTheme();
  const {layout} = usePrimaryNavigation();
  const {currentStepId} = useNavigationTour();
  const hoverProps = useResetActiveNavigationGroup();
  const {barTop} = useTopOffset();

  return (
    <Flex
      data-navigation-component="navigation-layout"
      top={barTop}
      left={0}
      position={currentStepId ? undefined : 'sticky'}
      bottom={layout === 'mobile' ? undefined : 0}
      height={
        layout === 'mobile'
          ? undefined
          : // barTop (marquee) and pageBannerHeight (marquee + alerts) overlap, so
            // max not sum; barTop also floors the height while pageBannerHeight's
            // ResizeObserver still reports 0 on first paint.
            `calc(100dvh - max(${barTop}, ${pageBannerHeight}px))`
      }
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

export function Navigation({pageBannerHeight = 0}: NavigationProps) {
  const organization = useOrganization({allowNull: true});

  if (!organization) {
    // @TODO(JonasBadalic): When this page gets any content, we should add the skip link back in.
    return (
      <HoverOverlayGroupProvider>
        <UserOnlyNavigation />
      </HoverOverlayGroupProvider>
    );
  }

  return (
    <HoverOverlayGroupProvider>
      <NavigationTourProvider>
        <SkipLink />
        <UserAndOrganizationNavigation pageBannerHeight={pageBannerHeight} />
      </NavigationTourProvider>
    </HoverOverlayGroupProvider>
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
