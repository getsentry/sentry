import {useCallback, useEffect, useLayoutEffect, useRef, useState} from 'react';
import {createPortal} from 'react-dom';
import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';

import {Button} from '@sentry/scraps/button';
import {Flex, Stack} from '@sentry/scraps/layout';

import Hook from 'sentry/components/hook';
import {IconChevron, IconClose, IconMenu} from 'sentry/icons';
import {t} from 'sentry/locale';
import {ConfigStore} from 'sentry/stores/configStore';
import {HookStore} from 'sentry/stores/hookStore';
import {isActiveSuperuser} from 'sentry/utils/isActiveSuperuser';
import {useLocation} from 'sentry/utils/useLocation';
import {useOnClickOutside} from 'sentry/utils/useOnClickOutside';
import {useOrganization} from 'sentry/utils/useOrganization';
import {NAVIGATION_MOBILE_TOPBAR_HEIGHT} from 'sentry/views/navigation/constants';
import {useNavigation} from 'sentry/views/navigation/navigationContext';
import {useNavigationTour} from 'sentry/views/navigation/navigationTour';
import {PrimaryNavigationItems} from 'sentry/views/navigation/primary/index';
import {OrganizationDropdown} from 'sentry/views/navigation/primary/organizationDropdown';
import {SecondaryNavigationContent} from 'sentry/views/navigation/secondary/content';

export function MobileNavigation() {
  const theme = useTheme();
  const location = useLocation();
  const organization = useOrganization();
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const [view, setView] = useState<'primary' | 'secondary' | 'closed'>('closed');
  const {layout, activeGroup} = useNavigation();
  const {currentStepId, endTour} = useNavigationTour();

  /** Close menu after any location pathname change */
  useEffect(() => setView('closed'), [location.pathname]);

  /** Sync menu state with `body` attributes */
  useLayoutEffect(() => {
    const mainContent = document.getElementById('main');
    if (!mainContent) {
      throw new Error(
        'Unable to match "#main" element. Please add `id="main"` to the element which wraps the app content.'
      );
    }

    if (view === 'closed') {
      mainContent.removeAttribute('inert');
      document.body.style.removeProperty('overflow');
    } else {
      mainContent.setAttribute('inert', '');
      document.body.style.setProperty('overflow', 'hidden');
    }
  }, [view]);

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
    <Flex
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
      top={0}
      style={{zIndex: theme.zIndex.sidebar}}
    >
      <Flex align="center" gap="md">
        {/* If the view is not closed, it will render under the full screen mobile menu */}
        <OrganizationDropdown onClick={() => setView('closed')} />
        {showSuperuserWarning && (
          <Hook name="component:superuser-warning" organization={organization} />
        )}
      </Flex>
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
          label={view === 'primary' ? t('Primary Navigation') : t('Secondary Navigation')}
          setView={setView}
          closeButtonRef={closeButtonRef}
        >
          {view === 'primary' ? (
            <PrimaryNavigationItems />
          ) : view === 'secondary' ? (
            <SecondaryMobileWrapper>
              <GroupHeader>
                <Button
                  size="xs"
                  priority="transparent"
                  onClick={() => setView('primary')}
                  icon={<IconChevron direction="left" />}
                  aria-label={t('Back to primary navigation')}
                >
                  {t('Back')}
                </Button>
              </GroupHeader>
              <Stack justify="start" align="stretch" overflowY="auto" area="content">
                <SecondaryNavigationContent />
              </Stack>
            </SecondaryMobileWrapper>
          ) : null}
        </NavigationOverlayPortal>
      )}
    </Flex>
  );
}

const SecondaryMobileWrapper = styled('div')`
  position: relative;
  height: 100%;

  display: grid;
  grid-template-areas:
    'header'
    'content';
  grid-template-rows: auto 1fr;
`;

const GroupHeader = styled('h2')`
  grid-area: header;
  position: sticky;
  top: 0;
  z-index: 1;
  background: ${p => p.theme.tokens.background.tertiary};
  display: flex;
  align-items: center;
  padding: ${p => p.theme.space.sm} ${p => p.theme.space.sm};
  gap: ${p => p.theme.space.md};
  margin: 0;
`;

interface NavigationOverlayPortalProps {
  children: React.ReactNode;
  closeButtonRef: React.RefObject<HTMLButtonElement | null>;
  label: string;
  setView: (view: 'primary' | 'secondary' | 'closed') => void;
}

function NavigationOverlayPortal(props: NavigationOverlayPortalProps) {
  const theme = useTheme();
  const ref = useRef<HTMLDivElement | null>(null);

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
