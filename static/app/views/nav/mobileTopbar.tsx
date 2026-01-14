import {useCallback, useEffect, useLayoutEffect, useRef, useState} from 'react';
import {createPortal} from 'react-dom';
import styled from '@emotion/styled';

import {Flex} from '@sentry/scraps/layout';

import {Button} from 'sentry/components/core/button';
import Hook from 'sentry/components/hook';
import {IconClose, IconMenu} from 'sentry/icons';
import {t} from 'sentry/locale';
import ConfigStore from 'sentry/stores/configStore';
import HookStore from 'sentry/stores/hookStore';
import {space} from 'sentry/styles/space';
import {isActiveSuperuser} from 'sentry/utils/isActiveSuperuser';
import {useLocation} from 'sentry/utils/useLocation';
import useOnClickOutside from 'sentry/utils/useOnClickOutside';
import useOrganization from 'sentry/utils/useOrganization';
import {NAV_MOBILE_TOPBAR_HEIGHT} from 'sentry/views/nav/constants';
import {OrganizationDropdown} from 'sentry/views/nav/organizationDropdown';
import {PrimaryNavigationItems} from 'sentry/views/nav/primary/index';
import {SecondaryMobile} from 'sentry/views/nav/secondary/secondaryMobile';
import {useActiveNavGroup} from 'sentry/views/nav/useActiveNavGroup';

type ActiveView = 'primary' | 'secondary' | 'closed';

function MobileTopbar() {
  const location = useLocation();
  const organization = useOrganization();
  const activeGroup = useActiveNavGroup();
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const [view, setView] = useState<ActiveView>('closed');
  /** Sync menu state with `body` attributes */
  useLayoutEffect(() => {
    updateNavStyleAttributes(view);
  }, [view]);
  /** Automatically close the menu after any navigation */
  useEffect(() => {
    setView('closed');
  }, [location.pathname]);
  const handleClick = useCallback(() => {
    setView(v => (v === 'closed' ? (activeGroup ? 'secondary' : 'primary') : 'closed'));
  }, [activeGroup]);

  // Avoid showing superuser UI on certain organizations
  const isExcludedOrg = HookStore.get('component:superuser-warning-excluded')[0]?.(
    organization
  );
  const showSuperuserWarning =
    isActiveSuperuser() && !ConfigStore.get('isSelfHosted') && !isExcludedOrg;

  return (
    <Topbar showSuperuserWarning={showSuperuserWarning}>
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
        borderless
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
    </Topbar>
  );
}

export default MobileTopbar;

/** When the mobile menu opens, set the main content to `inert` and disable `body` scrolling */
function updateNavStyleAttributes(view: ActiveView) {
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

function NavigationOverlayPortal({
  children,
  label,
  setView,
  closeButtonRef,
}: {
  children: React.ReactNode;
  closeButtonRef: React.RefObject<HTMLButtonElement | null>;
  label: string;
  setView: (view: ActiveView) => void;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  useOnClickOutside(ref, e => {
    // Without this check the menu will reopen when the click event triggers
    if (closeButtonRef.current?.contains(e.target as Node)) {
      return;
    }
    setView('closed');
  });
  return createPortal(
    <NavigationOverlay ref={ref} aria-label={label}>
      {children}
    </NavigationOverlay>,
    document.body
  );
}

const Topbar = styled('header')<{showSuperuserWarning: boolean}>`
  height: ${NAV_MOBILE_TOPBAR_HEIGHT}px;
  width: 100vw;
  padding-left: ${space(1.5)};
  padding-right: ${space(1.5)};
  border-bottom: 1px solid ${p => p.theme.colors.gray200};
  background: ${p => p.theme.colors.surface400};
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
  position: sticky;
  top: 0;
  z-index: ${p => p.theme.zIndex.sidebar};
`;

const NavigationOverlay = styled('nav')`
  position: fixed;
  top: 40px;
  right: 0;
  bottom: 0;
  left: 0;
  display: flex;
  flex-direction: column;
  background: ${p => p.theme.colors.surface300};
  z-index: ${p => p.theme.zIndex.modal};
  --color: ${p => p.theme.tokens.content.primary};
  --color-hover: ${p => p.theme.tokens.interactive.link.accent.rest};
`;
