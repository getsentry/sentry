import {useCallback, useEffect, useLayoutEffect, useState} from 'react';
import {createPortal} from 'react-dom';
import {css} from '@emotion/react';
import styled from '@emotion/styled';

import {Button} from 'sentry/components/core/button';
import Hook from 'sentry/components/hook';
import {TOPBAR_MOBILE_HEIGHT} from 'sentry/components/sidebar/constants';
import {IconClose, IconMenu} from 'sentry/icons';
import {t} from 'sentry/locale';
import ConfigStore from 'sentry/stores/configStore';
import HookStore from 'sentry/stores/hookStore';
import {space} from 'sentry/styles/space';
import {isActiveSuperuser} from 'sentry/utils/isActiveSuperuser';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import {useNavContext} from 'sentry/views/nav/context';
import {OrgDropdown} from 'sentry/views/nav/orgDropdown';
import {PrimaryNavigationItems} from 'sentry/views/nav/primary/index';
import {SecondaryMobile} from 'sentry/views/nav/secondaryMobile';

type ActiveView = 'primary' | 'secondary' | 'closed';

function MobileTopbar() {
  const {activeGroup} = useNavContext();
  const location = useLocation();
  const organization = useOrganization();
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
      <Left>
        <OrgDropdown />
        {showSuperuserWarning && (
          <Hook name="component:superuser-warning" organization={organization} />
        )}
      </Left>
      <Button
        onClick={handleClick}
        icon={view === 'closed' ? <IconMenu /> : <IconClose />}
        aria-label={view === 'closed' ? t('Open main menu') : t('Close main menu')}
        size="sm"
        borderless
      />
      {view === 'closed' ? null : (
        <NavigationOverlayPortal
          label={view === 'primary' ? t('Primary Navigation') : t('Secondary Navigation')}
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
}: {
  children: React.ReactNode;
  label: string;
}) {
  return createPortal(
    <NavigationOverlay aria-label={label}>{children}</NavigationOverlay>,
    document.body
  );
}

const Topbar = styled('header')<{showSuperuserWarning: boolean}>`
  height: ${TOPBAR_MOBILE_HEIGHT};
  width: 100vw;
  padding-left: ${space(1.5)};
  padding-right: ${space(1.5)};
  border-bottom: 1px solid ${p => p.theme.translucentGray200};
  background: ${p => p.theme.surface300};
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
  position: sticky;
  top: 0;
  z-index: ${p => p.theme.zIndex.sidebar};

  ${p =>
    p.showSuperuserWarning &&
    css`
      background: ${p.theme.sidebar.superuser};
    `}
`;

const Left = styled('div')`
  display: flex;
  align-items: center;
  gap: ${space(1)};
`;

const NavigationOverlay = styled('nav')`
  position: fixed;
  top: 40px;
  right: 0;
  bottom: 0;
  left: 0;
  display: flex;
  flex-direction: column;
  background: ${p => p.theme.surface200};
  z-index: ${p => p.theme.zIndex.modal};
  --color: ${p => p.theme.textColor};
  --color-hover: ${p => p.theme.activeText};
`;
