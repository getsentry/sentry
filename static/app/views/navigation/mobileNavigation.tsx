import {useCallback, useEffect, useRef, useState} from 'react';
import {createPortal} from 'react-dom';
import {useTheme} from '@emotion/react';

import {Button} from '@sentry/scraps/button';
import {Flex, type FlexProps, Stack} from '@sentry/scraps/layout';
import {SizeProvider} from '@sentry/scraps/sizeContext';
import {useScrollLock} from '@sentry/scraps/useScrollLock';

import {IconMenu} from 'sentry/icons';
import {t} from 'sentry/locale';
import {useOnClickOutside} from 'sentry/utils/useOnClickOutside';
import {
  NAVIGATION_MOBILE_TOPBAR_HEIGHT,
  NAVIGATION_MOBILE_TOPBAR_HEIGHT_WITH_PAGE_FRAME,
} from 'sentry/views/navigation/constants';
import {
  PrimaryNavigationFooterItems,
  PrimaryNavigationFooterItemsUserDropdown,
  PrimaryNavigationItems,
} from 'sentry/views/navigation/navigation';
import {PrimaryNavigation} from 'sentry/views/navigation/primary/components';
import {OrganizationDropdown} from 'sentry/views/navigation/primary/organizationDropdown';
import {SecondaryNavigation} from 'sentry/views/navigation/secondary/components';
import {SecondaryNavigationContent} from 'sentry/views/navigation/secondary/content';
import {useSecondaryNavigation} from 'sentry/views/navigation/secondaryNavigationContext';

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

export function MobileNavigation() {
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
    if (toggleButtonRef.current?.contains(e.target as Node)) {
      return;
    }
    if ((e.target as Element).closest?.('[data-overlay]')) {
      return;
    }
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
              if (!isOpen) {
                setView('expanded');
              }
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
