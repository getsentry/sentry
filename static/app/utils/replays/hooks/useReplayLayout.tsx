import {useMemo} from 'react';
import {useTheme} from '@emotion/react';
import type {Theme} from '@emotion/react';
import {parseAsStringLiteral, useQueryState} from 'nuqs';

import {useSyncedLocalStorageState} from 'sentry/utils/useSyncedLocalStorageState';
import {useWindowSize} from 'sentry/utils/window/useWindowSize';
import {
  NAVIGATION_SIDEBAR_SECONDARY_WIDTH_LOCAL_STORAGE_KEY,
  PRIMARY_SIDEBAR_WIDTH,
  SECONDARY_SIDEBAR_WIDTH,
} from 'sentry/views/navigation/constants';
import {useSecondaryNavigation} from 'sentry/views/navigation/secondaryNavigationContext';

export enum LayoutKey {
  /**
   * ### Top
   *┌────────────────────┐
   *│ Timeline           │
   *├───────────┬────────┤
   *│ Details   > Crumbs │
   *│           >        │
   *│           >        |
   *│           >        │
   *│           >        │
   *└───────────┴────────┘
   */
  NO_VIDEO = 'no_video',
  /**
   * ### Video Only
   *┌────────────────────┐
   *│ Timeline           │
   *├────────────────────┤
   *│                    │
   *│                    |
   *│       Video        │
   *│                    │
   *│                    │
   *└────────────────────┘
   */
  VIDEO_ONLY = 'video_only',
  /**
   * ### Topbar
   *┌────────────────────┐
   *│ Timeline           │
   *├───────────┬────────┤
   *│ Video     │ Crumbs │
   *│           │        │
   *├^^^^^^^^^^^^^^^^^^^^┤
   *│ Details            │
   *│                    │
   *└────────────────────┘
   */
  TOPBAR = 'topbar',
  /**
   * ### Sidebar Left
   * ┌───────────────────┐
   * │ Timeline          │
   * ├────────┬──────────┤
   * │ Video  > Details  │
   * │        >          │
   * │^^^^^^^ >          |
   * │ Crumbs >          │
   * │ Tabs   >          │
   * └────────┴──────────┘
   */
  SIDEBAR_LEFT = 'sidebar_left',
}

function getDefaultLayout(
  collapsed: boolean,
  theme: Theme,
  secondarySidebarWidth: number,
  {innerWidth, innerHeight} = {
    innerWidth: window.innerWidth,
    innerHeight: window.innerHeight,
  }
): LayoutKey {
  const sidebarWidth = collapsed
    ? PRIMARY_SIDEBAR_WIDTH
    : PRIMARY_SIDEBAR_WIDTH + secondarySidebarWidth;

  const mediumScreenWidth = parseInt(theme.breakpoints.md, 10);

  const windowsWidth =
    innerWidth <= mediumScreenWidth ? innerWidth : innerWidth - sidebarWidth;

  if (windowsWidth < innerHeight) {
    return LayoutKey.TOPBAR;
  }

  return LayoutKey.SIDEBAR_LEFT;
}

export function useDefaultReplayLayout(): LayoutKey {
  const theme = useTheme();
  const {view} = useSecondaryNavigation();
  const [secondarySidebarWidth] = useSyncedLocalStorageState(
    NAVIGATION_SIDEBAR_SECONDARY_WIDTH_LOCAL_STORAGE_KEY,
    SECONDARY_SIDEBAR_WIDTH
  );
  const windowSize = useWindowSize();
  return getDefaultLayout(view !== 'expanded', theme, secondarySidebarWidth, windowSize);
}

export function useReplayLayout() {
  const defaultLayout = useDefaultReplayLayout();

  const parser = useMemo(() => {
    return parseAsStringLiteral(Object.values(LayoutKey))
      .withDefault(defaultLayout)
      .withOptions({history: 'push', throttleMs: 0});
  }, [defaultLayout]);

  const [layout, setLayout] = useQueryState('l_page', parser);

  // We need to override the layout if the window resizes, because nuqs will
  // cache the value if we switched from video-only back to default.
  if (layout !== defaultLayout && layout !== LayoutKey.VIDEO_ONLY) {
    return [defaultLayout, setLayout] as const;
  }
  return [layout, setLayout] as const;
}
