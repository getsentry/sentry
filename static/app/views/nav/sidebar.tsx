import {Fragment} from 'react';
import {css} from '@emotion/react';
import styled from '@emotion/styled';
import {motion} from 'framer-motion';

import Hook from 'sentry/components/hook';
import ConfigStore from 'sentry/stores/configStore';
import HookStore from 'sentry/stores/hookStore';
import {space} from 'sentry/styles/space';
import {isActiveSuperuser} from 'sentry/utils/isActiveSuperuser';
import useOrganization from 'sentry/utils/useOrganization';
import {useSyncedLocalStorageState} from 'sentry/utils/useSyncedLocalStorageState';
import {
  NAV_SIDEBAR_SECONDARY_WIDTH_LOCAL_STORAGE_KEY,
  PRIMARY_SIDEBAR_WIDTH,
  SECONDARY_SIDEBAR_WIDTH,
} from 'sentry/views/nav/constants';
import {useNavContext} from 'sentry/views/nav/context';
import {OrgDropdown} from 'sentry/views/nav/orgDropdown';
import {PrimaryNavigationItems} from 'sentry/views/nav/primary/index';
import {SecondarySidebar} from 'sentry/views/nav/secondary/secondarySidebar';
import {useStackedNavigationTour, useTourModal} from 'sentry/views/nav/tour/tour';
import {useCollapsedNav} from 'sentry/views/nav/useCollapsedNav';

export function Sidebar() {
  const organization = useOrganization();
  const {isCollapsed: isCollapsedState} = useNavContext();

  // Avoid showing superuser UI on certain organizations
  const isExcludedOrg = HookStore.get('component:superuser-warning-excluded')[0]?.(
    organization
  );
  const showSuperuserWarning =
    isActiveSuperuser() && !ConfigStore.get('isSelfHosted') && !isExcludedOrg;

  const {currentStepId: currentStepId} = useStackedNavigationTour();

  const tourIsActive = currentStepId !== null;
  const forceExpanded = tourIsActive;
  const isCollapsed = forceExpanded ? false : isCollapsedState;
  const {isOpen} = useCollapsedNav();

  const [secondarySidebarWidth] = useSyncedLocalStorageState(
    NAV_SIDEBAR_SECONDARY_WIDTH_LOCAL_STORAGE_KEY,
    SECONDARY_SIDEBAR_WIDTH
  );

  useTourModal();

  return (
    <Fragment>
      <SidebarWrapper
        role="navigation"
        aria-label="Primary Navigation"
        tourIsActive={currentStepId !== null}
      >
        <SidebarHeader isSuperuser={showSuperuserWarning}>
          <OrgDropdown />
          {showSuperuserWarning && (
            <SuperuserBadge>
              <Hook name="component:superuser-warning" organization={organization} />
            </SuperuserBadge>
          )}
        </SidebarHeader>
        <PrimaryNavigationItems />
      </SidebarWrapper>
      {isCollapsed ? null : <SecondarySidebar />}
      {isCollapsed ? (
        <CollapsedSecondaryWrapper
          initial="hidden"
          animate={isOpen ? 'visible' : 'hidden'}
          variants={{
            visible: {x: 0},
            hidden: {x: -secondarySidebarWidth - 10},
          }}
          transition={{
            type: 'spring',
            damping: 50,
            stiffness: 700,
            bounce: 0,
            visualDuration: 0.1,
          }}
          data-test-id="collapsed-secondary-sidebar"
          data-visible={isOpen}
        >
          <SecondarySidebar />
        </CollapsedSecondaryWrapper>
      ) : null}
    </Fragment>
  );
}

const SidebarWrapper = styled('div')<{tourIsActive: boolean}>`
  width: ${PRIMARY_SIDEBAR_WIDTH}px;
  padding: ${space(1.5)} 0 ${space(1)} 0;
  border-right: 1px solid ${p => p.theme.tokens.border.primary};
  background: ${p => p.theme.tokens.background.primary};
  display: flex;
  flex-direction: column;

  ${p =>
    !p.tourIsActive &&
    css`
      z-index: ${p.theme.zIndex.sidebar};
    `}
`;

const CollapsedSecondaryWrapper = styled(motion.div)`
  position: absolute;
  top: 0;
  left: ${PRIMARY_SIDEBAR_WIDTH}px;
  height: 100%;
  box-shadow: none;
  background: ${p => p.theme.tokens.background.primary};
`;

const SidebarHeader = styled('header')<{isSuperuser: boolean}>`
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  margin-bottom: ${space(0.5)};
`;

const SuperuserBadge = styled('div')`
  position: absolute;
  top: -${p => p.theme.space.lg};
  z-index: ${p => p.theme.zIndex.initial};
  left: 0;
  width: ${PRIMARY_SIDEBAR_WIDTH}px;
  background: ${p => p.theme.colors.chonk.red400};
`;
