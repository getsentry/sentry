import {useTheme} from '@emotion/react';

import {getOverride} from 'sentry/overrideRegistry';
import {ConfigStore} from 'sentry/stores/configStore';
import {isActiveSuperuser} from 'sentry/utils/isActiveSuperuser';
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
    /**
     * Offset for sticky content *inside* the scrolling page pane, below the
     * sticky TopBar. Header height only: the pane already sits below the marquee,
     * so including it here would push in-page stickies down by the marquee height.
     */
    pageContentTop: `${headerHeight}px`,
  } as const;
}
