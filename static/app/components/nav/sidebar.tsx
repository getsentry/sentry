import {Fragment} from 'react';
import {css} from '@emotion/react';
import styled from '@emotion/styled';
import {motion} from 'framer-motion';

import Hook from 'sentry/components/hook';
import {
  PRIMARY_SIDEBAR_WIDTH,
  SECONDARY_SIDEBAR_WIDTH,
} from 'sentry/components/nav/constants';
import {useNavContext} from 'sentry/components/nav/context';
import {OrgDropdown} from 'sentry/components/nav/orgDropdown';
import {PrimaryNavigationItems} from 'sentry/components/nav/primary/index';
import {SecondarySidebar} from 'sentry/components/nav/secondarySidebar';
import {useStackedNavigationTour, useTourModal} from 'sentry/components/nav/tour/tour';
import {useCollapsedNav} from 'sentry/components/nav/useCollapsedNav';
import ConfigStore from 'sentry/stores/configStore';
import HookStore from 'sentry/stores/hookStore';
import {space} from 'sentry/styles/space';
import {isActiveSuperuser} from 'sentry/utils/isActiveSuperuser';
import useOrganization from 'sentry/utils/useOrganization';

export function Sidebar() {
  const organization = useOrganization();
  const {isCollapsed: isCollapsedState} = useNavContext();
  const {isOpen} = useCollapsedNav();

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
            <SuperuserBadgeContainer>
              <Hook name="component:superuser-warning" organization={organization} />
            </SuperuserBadgeContainer>
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
            hidden: {x: -SECONDARY_SIDEBAR_WIDTH - 10},
          }}
          transition={{duration: 0.15, ease: 'easeOut'}}
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
  border-right: 1px solid ${p => p.theme.translucentGray200};
  background: ${p => p.theme.surface300};
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
  box-shadow: ${p => p.theme.dropShadowHeavy};
`;

const SidebarHeader = styled('header')<{isSuperuser: boolean}>`
  position: relative;
  display: flex;
  justify-content: center;
  margin-bottom: ${space(0.5)};

  ${p =>
    p.isSuperuser &&
    css`
      &:before {
        content: '';
        position: absolute;
        inset: 0 ${space(1)} -${space(0.5)} ${space(1)};
        border-radius: ${p.theme.borderRadius};
        background: ${p.theme.sidebar.superuser};
      }
    `}
`;

const SuperuserBadgeContainer = styled('div')`
  position: absolute;
  top: -8px;
  left: 2px;
  right: 2px;
  font-size: 12px;
  margin: 0;
`;
