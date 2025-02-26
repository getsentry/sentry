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
import {PrimaryNavigationItems} from 'sentry/components/nav/primary/index';
import {SecondarySidebar} from 'sentry/components/nav/secondarySidebar';
import {useCollapsedNav} from 'sentry/components/nav/useCollapsedNav';
import SidebarDropdown from 'sentry/components/sidebar/sidebarDropdown';
import ConfigStore from 'sentry/stores/configStore';
import HookStore from 'sentry/stores/hookStore';
import {space} from 'sentry/styles/space';
import {isActiveSuperuser} from 'sentry/utils/isActiveSuperuser';
import useOrganization from 'sentry/utils/useOrganization';

export function Sidebar() {
  const organization = useOrganization();
  const {isCollapsed} = useNavContext();
  const {isOpen} = useCollapsedNav();

  // Avoid showing superuser UI on certain organizations
  const isExcludedOrg = HookStore.get('component:superuser-warning-excluded')[0]?.(
    organization
  );
  const showSuperuserWarning =
    isActiveSuperuser() && !ConfigStore.get('isSelfHosted') && !isExcludedOrg;

  return (
    <Fragment>
      <SidebarWrapper role="navigation" aria-label="Primary Navigation">
        <SidebarHeader isSuperuser={showSuperuserWarning}>
          <SidebarDropdown orientation="left" collapsed />
          {showSuperuserWarning && (
            <Hook name="component:superuser-warning" organization={organization} />
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

const SidebarWrapper = styled('div')`
  width: ${PRIMARY_SIDEBAR_WIDTH}px;
  padding: ${space(2)} 0 ${space(1)} 0;
  border-right: 1px solid ${p => p.theme.translucentGray200};
  background: ${p => p.theme.surface300};
  display: flex;
  flex-direction: column;
  z-index: ${p => p.theme.zIndex.sidebar};
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
  margin-bottom: ${space(1.5)};

  ${p =>
    p.isSuperuser &&
    css`
      &:before {
        content: '';
        position: absolute;
        inset: -${space(1)} ${space(1)};
        border-radius: ${p.theme.borderRadius};
        background: ${p.theme.sidebar.superuser};
      }
    `}
`;
