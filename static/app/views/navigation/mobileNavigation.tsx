import {useCallback, useEffect, useRef, useState} from 'react';
import {createPortal} from 'react-dom';
import {useTheme} from '@emotion/react';

import {Button} from '@sentry/scraps/button';
import {Flex, type FlexProps, Grid, Stack} from '@sentry/scraps/layout';
import {SizeProvider} from '@sentry/scraps/sizeContext';
import {useScrollLock} from '@sentry/scraps/useScrollLock';

import Hook from 'sentry/components/hook';
import {IconChevron, IconClose, IconMenu} from 'sentry/icons';
import {t} from 'sentry/locale';
import {ConfigStore} from 'sentry/stores/configStore';
import {HookStore} from 'sentry/stores/hookStore';
import {isActiveSuperuser} from 'sentry/utils/isActiveSuperuser';
import {useLocation} from 'sentry/utils/useLocation';
import {useOnClickOutside} from 'sentry/utils/useOnClickOutside';
import {useOrganization} from 'sentry/utils/useOrganization';
import {
  NAVIGATION_MOBILE_TOPBAR_HEIGHT,
  NAVIGATION_MOBILE_TOPBAR_HEIGHT_WITH_PAGE_FRAME,
} from 'sentry/views/navigation/constants';
import {
  PrimaryNavigationFooterItems,
  PrimaryNavigationFooterItemsUserDropdown,
  PrimaryNavigationItems,
} from 'sentry/views/navigation/navigation';
import {useNavigationTour} from 'sentry/views/navigation/navigationTour';
import {PrimaryNavigation} from 'sentry/views/navigation/primary/components';
import {OrganizationDropdown} from 'sentry/views/navigation/primary/organizationDropdown';
import {usePrimaryNavigation} from 'sentry/views/navigation/primaryNavigationContext';
import {SecondaryNavigation} from 'sentry/views/navigation/secondary/components';
import {SecondaryNavigationContent} from 'sentry/views/navigation/secondary/content';
import {useSecondaryNavigation} from 'sentry/views/navigation/secondaryNavigationContext';
import {useHasPageFrameFeature} from 'sentry/views/navigation/useHasPageFrameFeature';

export function MobileNavigation() {
  const location = useLocation();
  const organization = useOrganization();
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const [view, setView] = useState<'primary' | 'secondary' | 'closed'>('closed');
  const {layout, activeGroup} = usePrimaryNavigation();
  const {currentStepId, endTour} = useNavigationTour();

  /** Close menu after any location pathname change */
  useEffect(() => setView('closed'), [location.pathname]);

  const scrollLock = useScrollLock(document.getElementById('main')!);

  useEffect(() => {
    const main = document.getElementById('main');
    if (view === 'closed') {
      main?.removeAttribute('inert');
      scrollLock.release();
    } else {
      main?.setAttribute('inert', '');
      scrollLock.acquire();
    }

    return () => {
      main?.removeAttribute('inert');
      scrollLock.release();
    };
  }, [view, scrollLock]);

  // The tour only works with the sidebar layout, so if we change to the mobile
  // layout in the middle of the tour, it needs to end.
  useEffect(() => {
    if (currentStepId !== null && layout === 'mobile') {
      endTour();
    }
  }, [endTour, layout, currentStepId]);

  const handleClick = useCallback(
    () =>
      setView(v => (v === 'closed' ? (activeGroup ? 'secondary' : 'primary') : 'closed')),
    [activeGroup]
  );

  const showSuperuserWarning =
    isActiveSuperuser() &&
    !ConfigStore.get('isSelfHosted') &&
    !HookStore.get('component:superuser-warning-excluded')[0]?.(organization);

  return (
    <MobileNavigationHeader>
      <SizeProvider size="xs">
        <Flex align="center" gap="md">
          {/* If the view is not closed, it will render under the full screen mobile menu */}
          <OrganizationDropdown onClick={() => setView('closed')} />
          {showSuperuserWarning && (
            <Hook name="component:superuser-warning" organization={organization} />
          )}
        </Flex>
      </SizeProvider>
      <Button
        size="sm"
        ref={closeButtonRef}
        onClick={handleClick}
        icon={view === 'closed' ? <IconMenu /> : <IconClose />}
        aria-label={view === 'closed' ? t('Open main menu') : t('Close main menu')}
        priority="transparent"
      />
      {view === 'closed' ? null : (
        <NavigationOverlayPortal
          setView={setView}
          label={view === 'primary' ? t('Primary Navigation') : t('Secondary Navigation')}
          closeButtonRef={closeButtonRef}
        >
          <SizeProvider size="sm">
            {view === 'primary' ? (
              <Stack height="100%" justify="between">
                <PrimaryNavigation.List>
                  <PrimaryNavigationItems />
                </PrimaryNavigation.List>
                <Stack>
                  <PrimaryNavigationFooterItems />
                  <PrimaryNavigationFooterItemsUserDropdown />
                </Stack>
              </Stack>
            ) : view === 'secondary' ? (
              <Grid
                position="relative"
                height="100%"
                areas={`
              "header"
              "content"`}
                columns="1fr"
                rows="auto 1fr"
              >
                <Flex as="header" area="header" position="sticky" top={0} padding="md">
                  <Button
                    size="xs"
                    priority="transparent"
                    onClick={() => setView('primary')}
                    icon={<IconChevron direction="left" />}
                    aria-label={t('Back to primary navigation')}
                  >
                    {t('Back')}
                  </Button>
                </Flex>
                <Stack justify="start" align="stretch" overflowY="auto" area="content">
                  <SecondaryNavigationContent />
                </Stack>
              </Grid>
            ) : null}
          </SizeProvider>
        </NavigationOverlayPortal>
      )}
    </MobileNavigationHeader>
  );
}

function MobileNavigationHeader(props: FlexProps<'header'>) {
  const theme = useTheme();
  return (
    <Flex
      top={0}
      as="header"
      direction="row"
      align="center"
      height={`${NAVIGATION_MOBILE_TOPBAR_HEIGHT}px`}
      paddingLeft="lg"
      paddingRight="lg"
      width="100vw"
      borderBottom="primary"
      background="secondary"
      justify="between"
      position="sticky"
      overscrollBehavior="none"
      style={{zIndex: theme.zIndex.sidebar}}
      {...props}
    />
  );
}

function MobilePrimaryNavigation() {
  const {view} = useSecondaryNavigation();

  return (
    <SizeProvider size="sm">
      <PrimaryNavigation.Sidebar>
        <PrimaryNavigation.SidebarHeader>
          <OrganizationDropdown />
        </PrimaryNavigation.SidebarHeader>
        <PrimaryNavigation.List>
          <PrimaryNavigationItems />
        </PrimaryNavigation.List>
      </PrimaryNavigation.Sidebar>
      {view === 'expanded' && (
        <SecondaryNavigation.Sidebar>
          <SecondaryNavigationContent />
        </SecondaryNavigation.Sidebar>
      )}
    </SizeProvider>
  );
}

export function MobilePageFrameNavigation() {
  const theme = useTheme();
  const [isOpen, setIsOpen] = useState(false);
  const navPanelRef = useRef<HTMLDivElement>(null);
  const toggleButtonRef = useRef<HTMLButtonElement>(null);
  const {view, setView} = useSecondaryNavigation();
  const scrollLock = useScrollLock(document.getElementById('main')!);

  useEffect(() => {
    const main = document.getElementById('main');
    if (isOpen) {
      main?.setAttribute('inert', '');
      scrollLock.acquire();
    } else {
      main?.removeAttribute('inert');
      if (scrollLock.held()) {
        setView('expanded');
      }
      scrollLock.release();
    }
    return () => {
      main?.removeAttribute('inert');
      scrollLock.release();
    };
  }, [isOpen, scrollLock, setView]);

  // Close the panel when the secondary nav's IconPanel button is clicked,
  // which sets view to 'collapsed'.
  useEffect(() => {
    if (isOpen && view === 'collapsed') {
      setIsOpen(false);
    }
  }, [isOpen, view]);

  const handleClickOutside = useCallback((e: MouseEvent | TouchEvent) => {
    if (toggleButtonRef.current?.contains(e.target as Node)) return;
    setIsOpen(false);
  }, []);

  useOnClickOutside(navPanelRef, handleClickOutside);

  return (
    <SizeProvider size="sm">
      <MobileNavigationHeader
        padding="sm"
        height={`${NAVIGATION_MOBILE_TOPBAR_HEIGHT_WITH_PAGE_FRAME}px`}
      >
        <Flex align="center" gap="md" justify="between" width="100%">
          <Button
            ref={toggleButtonRef}
            onClick={() => {
              if (!isOpen) setView('expanded');
              setIsOpen(v => !v);
            }}
            icon={<IconMenu aria-hidden="true" />}
            aria-label={isOpen ? t('Close main menu') : t('Open main menu')}
          />
          <Stack gap="md" direction="row">
            <PrimaryNavigation.ButtonBar orientation="horizontal">
              <PrimaryNavigationFooterItems />
            </PrimaryNavigation.ButtonBar>
            <PrimaryNavigationFooterItemsUserDropdown />
          </Stack>
        </Flex>
      </MobileNavigationHeader>
      {isOpen &&
        createPortal(
          <Flex
            ref={navPanelRef}
            position="fixed"
            top={0}
            left={0}
            bottom={0}
            width="100vw"
            maxWidth="368px"
            style={{zIndex: theme.zIndex.modal}}
          >
            <MobilePrimaryNavigation />
          </Flex>,
          document.body
        )}
    </SizeProvider>
  );
}

interface NavigationOverlayPortalProps {
  children: React.ReactNode;
  closeButtonRef: React.RefObject<HTMLButtonElement | null>;
  label: string;
  setView: (view: 'primary' | 'secondary' | 'closed') => void;
}

function NavigationOverlayPortal(props: NavigationOverlayPortalProps) {
  const theme = useTheme();
  const ref = useRef<HTMLDivElement | null>(null);
  const hasPageFrame = useHasPageFrameFeature();

  useOnClickOutside(ref, e => {
    // Without this check the menu will reopen when the click event triggers
    if (props.closeButtonRef.current?.contains(e.target as Node)) {
      return;
    }
    props.setView('closed');
  });

  return createPortal(
    <Flex
      ref={ref}
      as="nav"
      aria-label={props.label}
      justify={hasPageFrame ? 'between' : undefined}
      direction="column"
      background="tertiary"
      position="fixed"
      top={`${NAVIGATION_MOBILE_TOPBAR_HEIGHT}px`}
      right={0}
      bottom={0}
      left={0}
      style={{zIndex: theme.zIndex.modal}}
    >
      {props.children}
    </Flex>,
    document.body
  );
}
