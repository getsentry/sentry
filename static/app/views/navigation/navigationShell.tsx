import {useTheme} from '@emotion/react';

import {Container, Flex} from '@sentry/scraps/layout';

import {useSyncedLocalStorageState} from 'sentry/utils/useSyncedLocalStorageState';
import {
  NAVIGATION_SIDEBAR_SECONDARY_WIDTH_LOCAL_STORAGE_KEY,
  SECONDARY_SIDEBAR_WIDTH,
} from 'sentry/views/navigation/constants';
import {PrimaryNavigation} from 'sentry/views/navigation/primary/components';
import {usePrimaryNavigation} from 'sentry/views/navigation/primaryNavigationContext';
import {useTopOffset} from 'sentry/views/navigation/useTopOffset';

/**
 * Renders a static skeleton of the navigation sidebar before the organization
 * has loaded. Uses the same layout primitives as the real Navigation so the
 * dimensions are identical and there is no layout shift when the real nav
 * mounts.
 *
 * Cannot reuse NavigationLayout because useNavigationTour() throws without
 * NavigationTourProvider, so the sticky-positioning Flex is inlined here.
 */
export function NavigationSidebarShell() {
  const theme = useTheme();
  const {layout} = usePrimaryNavigation();
  const {barTop} = useTopOffset();
  const [secondaryWidth] = useSyncedLocalStorageState(
    NAVIGATION_SIDEBAR_SECONDARY_WIDTH_LOCAL_STORAGE_KEY,
    SECONDARY_SIDEBAR_WIDTH
  );

  return (
    <Flex
      top={barTop}
      left={0}
      position="sticky"
      bottom={layout === 'mobile' ? undefined : 0}
      height={layout === 'mobile' ? undefined : `calc(100dvh - ${barTop})`}
      style={{zIndex: theme.zIndex.sidebarPanel, userSelect: 'none'}}
    >
      <PrimaryNavigation.Sidebar>
        <PrimaryNavigation.SidebarHeader />
      </PrimaryNavigation.Sidebar>
      <Container
        background="secondary"
        borderRight="primary"
        width={`${secondaryWidth}px`}
        height="100%"
        display={layout === 'mobile' ? 'none' : undefined}
      />
    </Flex>
  );
}
