import {createContext, useContext} from 'react';
import {useTheme} from '@emotion/react';

import {getOverride} from 'sentry/overrideRegistry';
import {ConfigStore} from 'sentry/stores/configStore';
import {isActiveSuperuser} from 'sentry/utils/isActiveSuperuser';
import {useMedia} from 'sentry/utils/useMedia';
import {useOrganization} from 'sentry/utils/useOrganization';
import {
  NAVIGATION_MOBILE_TOPBAR_HEIGHT_WITH_PAGE_FRAME,
  PRIMARY_HEADER_HEIGHT,
  SUPERUSER_MARQUEE_HEIGHT,
} from 'sentry/views/navigation/constants';

/**
 * Measured height of the global banner region (superuser marquee + in-flow
 * SystemAlerts) that sits above the nav + content row. Only AppLayout can
 * measure it, so it flows down through context. Defaults to 0 outside the
 * provider (tests, Storybook, standalone primitives) — those trees have no
 * banner, so the fallback is correct rather than merely safe.
 */
const BannerHeightContext = createContext(0);

export function BannerHeightProvider({
  height,
  children,
}: {
  children: React.ReactNode;
  height: number;
}) {
  return <BannerHeightContext value={height}>{children}</BannerHeightContext>;
}

interface TopOffset {
  /**
   * Measured banner region height (marquee + SystemAlerts), for sizing the nav
   * against the viewport. 0 outside the provider.
   */
  bannerHeight: number;
  /** `top` where sticky page content starts: below the marquee and the header. */
  stickyContentTop: string;
  /** `top` where the nav sidebar sticks: below the marquee only. */
  stickyNavTop: string;
}

export function useTopOffset(): TopOffset {
  const theme = useTheme();
  const organization = useOrganization({allowNull: true});
  const isMobile = !useMedia(`(min-width: ${theme.breakpoints.md})`);
  const bannerHeight = useContext(BannerHeightContext);
  const showSuperuserWarning =
    isActiveSuperuser() &&
    !ConfigStore.get('isSelfHosted') &&
    !getOverride('component:superuser-warning-excluded')?.(organization);

  const superuserOffset = showSuperuserWarning ? SUPERUSER_MARQUEE_HEIGHT : 0;
  const headerHeight = isMobile
    ? NAVIGATION_MOBILE_TOPBAR_HEIGHT_WITH_PAGE_FRAME
    : PRIMARY_HEADER_HEIGHT;

  return {
    bannerHeight,
    stickyNavTop: `${superuserOffset}px`,
    stickyContentTop: `${superuserOffset + headerHeight}px`,
  };
}
