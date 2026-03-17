import {Fragment, useMemo} from 'react';
import {motion, type MotionProps} from 'framer-motion';

import {Flex} from '@sentry/scraps/layout';

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
import {PrimaryNavigation} from 'sentry/views/navigation/primary/components';
import {PrimaryNavigationItems} from 'sentry/views/navigation/primary/index';
import {OrganizationDropdown} from 'sentry/views/navigation/primary/organizationDropdown';
import {SecondaryNavigation} from 'sentry/views/navigation/secondary/components';
import {SecondaryNavigationContent} from 'sentry/views/navigation/secondary/content';
import {useSecondaryNavigation} from 'sentry/views/navigation/secondaryNavigationContext';
import {useCollapsedNavigation} from 'sentry/views/navigation/useCollapsedNavigation';

export function Navigation() {
  const collapsedNavigation = useCollapsedNavigation();
  const {view} = useSecondaryNavigation();

  useNavigationTourModal();

  const {currentStepId} = useNavigationTour();
  const isCollapsed = currentStepId === null ? view !== 'expanded' : false;

  const [secondarySidebarWidth] = useSyncedLocalStorageState(
    NAVIGATION_SIDEBAR_SECONDARY_WIDTH_LOCAL_STORAGE_KEY,
    SECONDARY_SIDEBAR_WIDTH
  );

  const sidebarAnimationProps = useMemo(
    () =>
      makeCollapsedSecondaryWrapperAnimationProps(
        collapsedNavigation.view === 'peek',
        secondarySidebarWidth
      ),
    [collapsedNavigation.view, secondarySidebarWidth]
  );

  return (
    <Fragment>
      <PrimaryNavigation.Sidebar>
        <PrimaryNavigation.SidebarHeader>
          <OrganizationDropdown />
        </PrimaryNavigation.SidebarHeader>
        <PrimaryNavigationItems />
      </PrimaryNavigation.Sidebar>
      {isCollapsed ? (
        <CollapsedSecondaryWrapper
          data-visible={collapsedNavigation.view === 'peek'}
          data-test-id="collapsed-secondary-sidebar"
          height="100%"
          left={`${PRIMARY_SIDEBAR_WIDTH}px`}
          top={0}
          position="absolute"
          background="primary"
          {...sidebarAnimationProps}
        >
          <SecondaryNavigation.Sidebar>
            <SecondaryNavigationContent />
          </SecondaryNavigation.Sidebar>
        </CollapsedSecondaryWrapper>
      ) : (
        <SecondaryNavigation.Sidebar>
          <SecondaryNavigationContent />
        </SecondaryNavigation.Sidebar>
      )}
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
