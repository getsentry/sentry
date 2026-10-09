import {useTheme} from '@emotion/react';

import {getOverride} from 'sentry/overrideRegistry';
import {ConfigStore} from 'sentry/stores/configStore';
import {isActiveSuperuser} from 'sentry/utils/isActiveSuperuser';
import {useIsSeerExplorerSidebarEnabled} from 'sentry/utils/seer/isSeerExplorerEnabled';
import {useMedia} from 'sentry/utils/useMedia';
import {useOrganization} from 'sentry/utils/useOrganization';
import {
  NAVIGATION_MOBILE_CONTENT_HEIGHT,
  PRIMARY_HEADER_HEIGHT,
  SUPERUSER_MARQUEE_HEIGHT,
} from 'sentry/views/navigation/constants';

export function useTopOffset() {
  const theme = useTheme();
  const organization = useOrganization({allowNull: true});
  const isMobile = !useMedia(`(min-width: ${theme.breakpoints.md})`);
  const showSuperuserWarning =
    isActiveSuperuser() &&
    !ConfigStore.get('isSelfHosted') &&
    !getOverride('component:superuser-warning-excluded')?.(organization);

  const superuserOffset = showSuperuserWarning ? SUPERUSER_MARQUEE_HEIGHT : 0;
  // In the Seer Explorer sidebar layout the content pane is its own scroll
  // container and already sits below the marquee. Otherwise the window scrolls,
  // so in-page stickies have to clear the fixed marquee themselves.
  const isPaneScroller = useIsSeerExplorerSidebarEnabled();
  const pageTopOffset = isPaneScroller ? 0 : superuserOffset;
  const headerHeight = isMobile
    ? NAVIGATION_MOBILE_CONTENT_HEIGHT
    : PRIMARY_HEADER_HEIGHT;

  return {
    /** The `top` CSS value for the sticky nav sidebar itself (marquee only) */
    barTop: `${superuserOffset}px`,
    /**
     * Offset from the viewport top, past the marquee and the header. For
     * viewport-fixed overlays (drawers, the widget builder) that anchor to the
     * screen, not to the scrolling content pane.
     */
    contentTop: `${superuserOffset + headerHeight}px`,
    /** The `top` CSS value for the sticky TopBar inside the page content */
    topBarTop: `${pageTopOffset}px`,
    /** Offset for sticky content inside the page content, below the sticky TopBar */
    pageContentTop: `${pageTopOffset + headerHeight}px`,
  } as const;
}
