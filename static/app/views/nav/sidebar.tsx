import {Fragment} from 'react';
import {css} from '@emotion/react';
import styled from '@emotion/styled';

import Hook from 'sentry/components/hook';
import ConfigStore from 'sentry/stores/configStore';
import HookStore from 'sentry/stores/hookStore';
import {space} from 'sentry/styles/space';
import {isActiveSuperuser} from 'sentry/utils/isActiveSuperuser';
import {chonkStyled} from 'sentry/utils/theme/theme.chonk';
import {withChonk} from 'sentry/utils/theme/withChonk';
import useOrganization from 'sentry/utils/useOrganization';
import {PRIMARY_SIDEBAR_WIDTH} from 'sentry/views/nav/constants';
import {useNavContext} from 'sentry/views/nav/context';
import {OrgDropdown} from 'sentry/views/nav/orgDropdown';
import {PrimaryNavigationItems} from 'sentry/views/nav/primary/index';
import {SecondarySidebar} from 'sentry/views/nav/secondary/secondarySidebar';
import {useStackedNavigationTour, useTourModal} from 'sentry/views/nav/tour/tour';

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
    </Fragment>
  );
}

const SidebarWrapper = styled('div')<{tourIsActive: boolean}>`
  width: ${PRIMARY_SIDEBAR_WIDTH}px;
  padding: ${space(1.5)} 0 ${space(1)} 0;
  border-right: 1px solid
    ${p => (p.theme.isChonk ? p.theme.border : p.theme.translucentGray200)};
  background: ${p => (p.theme.isChonk ? p.theme.background : p.theme.surface300)};
  display: flex;
  flex-direction: column;

  ${p =>
    !p.tourIsActive &&
    css`
      z-index: ${p.theme.zIndex.sidebar};
    `}
`;

const SidebarHeader = styled('header')<{isSuperuser: boolean}>`
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  margin-bottom: ${space(0.5)};

  ${p =>
    p.isSuperuser &&
    !p.theme.isChonk &&
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

const ChonkSuperuserBadgeContainer = chonkStyled('div')`
  position: fixed;
  top: -1px;
  left: 0;
  width: ${PRIMARY_SIDEBAR_WIDTH}px;
  background: ${p => p.theme.colors.chonk.red400};
`;

const SuperuserBadge = withChonk(SuperuserBadgeContainer, ChonkSuperuserBadgeContainer);
