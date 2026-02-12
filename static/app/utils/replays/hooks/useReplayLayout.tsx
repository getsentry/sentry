import {useCallback} from 'react';
import {useTheme} from '@emotion/react';
import type {Theme} from '@emotion/react';
import {parseAsStringLiteral, useQueryState} from 'nuqs';

import {trackAnalytics} from 'sentry/utils/analytics';
import useOrganization from 'sentry/utils/useOrganization';
import {useSyncedLocalStorageState} from 'sentry/utils/useSyncedLocalStorageState';
import {
  NAV_SIDEBAR_SECONDARY_WIDTH_LOCAL_STORAGE_KEY,
  PRIMARY_SIDEBAR_WIDTH,
  SECONDARY_SIDEBAR_WIDTH,
} from 'sentry/views/nav/constants';
import {useNavContext} from 'sentry/views/nav/context';

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

function isLayout(val: string): val is LayoutKey {
  return val in LayoutKey;
}

function getDefaultLayout(
  collapsed: boolean,
  theme: Theme,
  secondarySidebarWidth: number
): LayoutKey {
  const {innerWidth, innerHeight} = window;

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

export default function useReplayLayout() {
  const theme = useTheme();
  const {isCollapsed} = useNavContext();
  const [secondarySidebarWidth] = useSyncedLocalStorageState(
    NAV_SIDEBAR_SECONDARY_WIDTH_LOCAL_STORAGE_KEY,
    SECONDARY_SIDEBAR_WIDTH
  );
  const defaultLayout = getDefaultLayout(isCollapsed, theme, secondarySidebarWidth);

  const organization = useOrganization();

  const [layoutValue, setLayoutValue] = useQueryState(
    'l_page',
    parseAsStringLiteral(Object.values(LayoutKey))
      .withDefault(defaultLayout)
      .withOptions({history: 'push', throttleMs: 0})
  );

  return {
    getLayout: useCallback((): LayoutKey => layoutValue, [layoutValue]),
    setLayout: useCallback(
      (value: string) => {
        const chosenLayout = isLayout(value) ? value : defaultLayout;

        setLayoutValue(chosenLayout);
        trackAnalytics('replay.details-layout-changed', {
          organization,
          default_layout: defaultLayout,
          chosen_layout: chosenLayout,
        });
      },
      [organization, defaultLayout, setLayoutValue]
    ),
  };
}
