import {useCallback, useEffect, useLayoutEffect, useRef, useState} from 'react';
import {createPortal} from 'react-dom';
import {useTheme} from '@emotion/react';

import {Button} from '@sentry/scraps/button';
import {Flex} from '@sentry/scraps/layout';

import Hook from 'sentry/components/hook';
import {IconClose, IconMenu} from 'sentry/icons';
import {t} from 'sentry/locale';
import ConfigStore from 'sentry/stores/configStore';
import HookStore from 'sentry/stores/hookStore';
import {isActiveSuperuser} from 'sentry/utils/isActiveSuperuser';
import {useLocation} from 'sentry/utils/useLocation';
import useOnClickOutside from 'sentry/utils/useOnClickOutside';
import useOrganization from 'sentry/utils/useOrganization';
import {NAVIGATION_MOBILE_TOPBAR_HEIGHT} from 'sentry/views/navigation/constants';
import {PrimaryNavigationItems} from 'sentry/views/navigation/primary/index';
import {OrganizationDropdown} from 'sentry/views/navigation/primary/organizationDropdown';
import {SecondaryMobile} from 'sentry/views/navigation/secondary/secondaryMobile';
import {useActiveNavigationGroup} from 'sentry/views/navigation/useActiveNavigationGroup';

type ActiveView = 'primary' | 'secondary' | 'closed';

export function MobileNavigation() {
  const theme = useTheme();
  const location = useLocation();
  const organization = useOrganization();
  const activeGroup = useActiveNavigationGroup();
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const [view, setView] = useState<ActiveView>('closed');

  /** Sync menu state with `body` attributes */
  useLayoutEffect(() => {
    updateNavigationStyleAttributes(view);
  }, [view]);

  /** Close menu after any location pathname change */
  useEffect(() => setView('closed'), [location.pathname]);

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
        ref={closeButtonRef}
        onClick={handleClick}
        icon={view === 'closed' ? <IconMenu /> : <IconClose />}
        aria-label={view === 'closed' ? t('Open main menu') : t('Close main menu')}
        size="sm"
        priority="transparent"
      />
      {view === 'closed' ? null : (
        <NavigationOverlayPortal
          label={view === 'primary' ? t('Primary Navigation') : t('Secondary Navigation')}
          setView={setView}
          closeButtonRef={closeButtonRef}
        >
          {view === 'primary' ? <PrimaryNavigationItems /> : null}
          {view === 'secondary' ? (
            <SecondaryMobile handleClickBack={() => setView('primary')} />
          ) : null}
        </NavigationOverlayPortal>
      )}
    </Flex>
  );
}

interface NavigationOverlayPortalProps {
  children: React.ReactNode;
  closeButtonRef: React.RefObject<HTMLButtonElement | null>;
  label: string;
  setView: (view: ActiveView) => void;
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

/** When the mobile menu opens, set the main content to `inert` and disable `body` scrolling */
function updateNavigationStyleAttributes(view: ActiveView) {
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
}
