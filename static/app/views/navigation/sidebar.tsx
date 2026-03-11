import {Fragment} from 'react';
import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';
import {motion, type MotionProps} from 'framer-motion';

import {Flex} from '@sentry/scraps/layout';

import Hook from 'sentry/components/hook';
import ConfigStore from 'sentry/stores/configStore';
import HookStore from 'sentry/stores/hookStore';
import {isActiveSuperuser} from 'sentry/utils/isActiveSuperuser';
import useOrganization from 'sentry/utils/useOrganization';
import {useSyncedLocalStorageState} from 'sentry/utils/useSyncedLocalStorageState';
import {
  NAVIGATION_SIDEBAR_SECONDARY_WIDTH_LOCAL_STORAGE_KEY,
  PRIMARY_SIDEBAR_WIDTH,
  SECONDARY_SIDEBAR_WIDTH,
} from 'sentry/views/navigation/constants';
import {useNavigationContext} from 'sentry/views/navigation/context';
import {
  useNavigationTour,
  useNavigationTourModal,
} from 'sentry/views/navigation/navigationTour';
import {PrimaryNavigationItems} from 'sentry/views/navigation/primary/index';
import {OrganizationDropdown} from 'sentry/views/navigation/primary/organizationDropdown';
import {SecondarySidebar} from 'sentry/views/navigation/secondary/secondarySidebar';
import {useCollapsedNavigation} from 'sentry/views/navigation/useCollapsedNavigation';

export function Sidebar() {
  const theme = useTheme();
  const organization = useOrganization();
  const {isCollapsed: isCollapsedState} = useNavigationContext();

  // Avoid showing superuser UI on certain organizations
  const isExcludedOrg = HookStore.get('component:superuser-warning-excluded')[0]?.(
    organization
  );
  const showSuperuserWarning =
    isActiveSuperuser() && !ConfigStore.get('isSelfHosted') && !isExcludedOrg;

  const {currentStepId: currentStepId} = useNavigationTour();

  const tourIsActive = currentStepId !== null;
  const forceExpanded = tourIsActive;
  const isCollapsed = forceExpanded ? false : isCollapsedState;
  const {isOpen} = useCollapsedNavigation();

  const [secondarySidebarWidth] = useSyncedLocalStorageState(
    NAVIGATION_SIDEBAR_SECONDARY_WIDTH_LOCAL_STORAGE_KEY,
    SECONDARY_SIDEBAR_WIDTH
  );

  useNavigationTourModal();

  return (
    <Fragment>
      <Flex
        as="nav"
        width={PRIMARY_SIDEBAR_WIDTH}
        padding="lg 0 md 0"
        borderRight="primary"
        background="primary"
        direction="column"
        style={{zIndex: tourIsActive ? undefined : theme.zIndex.sidebar}}
      >
        <Flex
          as="header"
          direction="column"
          align="center"
          justify="center"
          position="relative"
        >
          <OrganizationDropdown />
          {showSuperuserWarning && (
            <SuperuserBadge>
              <Hook name="component:superuser-warning" organization={organization} />
            </SuperuserBadge>
          )}
        </Flex>
        <PrimaryNavigationItems />
      </Flex>
      {isCollapsed ? null : <SecondarySidebar />}
      {isCollapsed ? (
        <CollapsedSecondaryWrapper
          data-visible={isOpen}
          data-test-id="collapsed-secondary-sidebar"
          height="100%"
          left={PRIMARY_SIDEBAR_WIDTH}
          top={0}
          position="absolute"
          background="primary"
          {...makeCollapsedSecondaryWrapperAnimationProps(isOpen, secondarySidebarWidth)}
        >
          <SecondarySidebar />
        </CollapsedSecondaryWrapper>
      ) : null}
    </Fragment>
  );
}

const CollapsedSecondaryWrapper = motion.create(Flex);
const makeCollapsedSecondaryWrapperAnimationProps = (
  open: boolean,
  left: number
): MotionProps => {
  return {
    initial: 'hidden',
    animate: open ? 'visible' : 'hidden',
    variants: {
      visible: {x: 0},
      hidden: {x: -left - 10},
    },
    transition: {
      type: 'spring',
      damping: 50,
      stiffness: 700,
      bounce: 0,
      visualDuration: 0.1,
    },
  };
};

const SuperuserBadge = styled('div')`
  position: absolute;
  top: -${p => p.theme.space.lg};
  z-index: ${p => p.theme.zIndex.initial};
  left: 0;
  width: ${PRIMARY_SIDEBAR_WIDTH}px;
  background: ${p => p.theme.tokens.background.danger.vibrant};
`;
