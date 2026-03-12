import {Fragment, useMemo} from 'react';
import {useTheme} from '@emotion/react';
import {motion, type MotionProps} from 'framer-motion';

import {Container, Flex} from '@sentry/scraps/layout';

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
import {
  useNavigationTour,
  useNavigationTourModal,
} from 'sentry/views/navigation/navigationTour';
import {PrimaryNavigationItems} from 'sentry/views/navigation/primary/index';
import {OrganizationDropdown} from 'sentry/views/navigation/primary/organizationDropdown';
import {SecondarySidebar} from 'sentry/views/navigation/secondary/secondarySidebar';
import {useSecondaryNavigation} from 'sentry/views/navigation/secondaryNavigationContext';
import {useCollapsedNavigation} from 'sentry/views/navigation/useCollapsedNavigation';

export function Navigation() {
  const theme = useTheme();
  const organization = useOrganization();

  const collapsedNavigation = useCollapsedNavigation();
  const {isCollapsed: sidebarIsCollapsed} = useSecondaryNavigation();

  useNavigationTourModal();

  const showSuperuserWarning =
    isActiveSuperuser() &&
    !ConfigStore.get('isSelfHosted') &&
    !HookStore.get('component:superuser-warning-excluded')[0]?.(organization);

  const {currentStepId} = useNavigationTour();
  const isCollapsed = currentStepId === null ? sidebarIsCollapsed : false;

  const [secondarySidebarWidth] = useSyncedLocalStorageState(
    NAVIGATION_SIDEBAR_SECONDARY_WIDTH_LOCAL_STORAGE_KEY,
    SECONDARY_SIDEBAR_WIDTH
  );

  const sidebarAnimationProps = useMemo(
    () =>
      makeCollapsedSecondaryWrapperAnimationProps(
        collapsedNavigation.isOpen,
        secondarySidebarWidth
      ),
    [collapsedNavigation.isOpen, secondarySidebarWidth]
  );

  return (
    <Fragment>
      <Flex
        as="nav"
        aria-label="Primary Navigation"
        width={`${PRIMARY_SIDEBAR_WIDTH}px`}
        padding="lg 0 md 0"
        borderRight="primary"
        background="primary"
        direction="column"
        style={{zIndex: currentStepId === null ? theme.zIndex.sidebar : undefined}}
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
            <Container
              position="absolute"
              top={`-${theme.space.lg}`}
              left={0}
              width={`${PRIMARY_SIDEBAR_WIDTH}px`}
              style={{
                zIndex: theme.zIndex.initial,
                background: theme.tokens.background.danger.vibrant,
              }}
            >
              <Hook name="component:superuser-warning" organization={organization} />
            </Container>
          )}
        </Flex>
        <PrimaryNavigationItems />
      </Flex>
      {isCollapsed ? null : <SecondarySidebar />}
      {isCollapsed ? (
        <CollapsedSecondaryWrapper
          data-visible={collapsedNavigation.isOpen}
          data-test-id="collapsed-secondary-sidebar"
          height="100%"
          left={`${PRIMARY_SIDEBAR_WIDTH}px`}
          top={0}
          position="absolute"
          background="primary"
          {...sidebarAnimationProps}
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
