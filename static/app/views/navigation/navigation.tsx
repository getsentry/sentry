import {useMemo, useRef} from 'react';
import {motion, type MotionProps} from 'framer-motion';

import {Flex, Stack} from '@sentry/scraps/layout';

import {useSyncedLocalStorageState} from 'sentry/utils/useSyncedLocalStorageState';
import {PrimaryNavigation} from 'sentry/views/navigation/components/primary';
import {
  NAVIGATION_SIDEBAR_SECONDARY_WIDTH_LOCAL_STORAGE_KEY,
  PRIMARY_SIDEBAR_WIDTH,
  SECONDARY_SIDEBAR_WIDTH,
} from 'sentry/views/navigation/constants';
import {useNavigationContext} from 'sentry/views/navigation/navigationContext';
import {
  useNavigationTour,
  useNavigationTourModal,
} from 'sentry/views/navigation/navigationTour';
import {
  PrimaryNavigationItems,
  PrimaryNavigationSecondaryItems,
} from 'sentry/views/navigation/primary/index';
import {OrganizationDropdown} from 'sentry/views/navigation/primary/organizationDropdown';
import {useActivateNavigationGroupOnHover} from 'sentry/views/navigation/primary/useActivateNavigationGroupOnHover';
import {SecondarySidebar} from 'sentry/views/navigation/secondary/secondarySidebar';
import {useCollapsedNavigation} from 'sentry/views/navigation/useCollapsedNavigation';

export function Navigation() {
  const collapsedNavigation = useCollapsedNavigation();
  const navigationContext = useNavigationContext();

  useNavigationTourModal();

  const {currentStepId} = useNavigationTour();
  const isCollapsed = currentStepId === null ? navigationContext.isCollapsed : false;

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

  const ref = useRef<HTMLUListElement>(null);
  const makeNavigationItemProps = useActivateNavigationGroupOnHover({ref});

  return (
    <PrimaryNavigation>
      <PrimaryNavigation.Sidebar>
        <Stack justify="between" height="100%">
          <Stack direction="column" gap="md">
            <PrimaryNavigation.Header>
              <OrganizationDropdown />
            </PrimaryNavigation.Header>
            <PrimaryNavigation.Items ref={ref}>
              <PrimaryNavigationItems makeNavigationItemProps={makeNavigationItemProps} />
            </PrimaryNavigation.Items>
          </Stack>
          <PrimaryNavigationSecondaryItems />
        </Stack>
      </PrimaryNavigation.Sidebar>

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
    </PrimaryNavigation>
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
