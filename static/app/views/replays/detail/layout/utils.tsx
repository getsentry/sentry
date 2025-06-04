import type {Theme} from '@emotion/react';

import {
  SIDEBAR_COLLAPSED_WIDTH,
  SIDEBAR_EXPANDED_WIDTH,
} from 'sentry/components/sidebar/constants';
import {LayoutKey} from 'sentry/utils/replays/hooks/useReplayLayout';

export const getDefaultLayout = (collapsed: boolean, theme: Theme): LayoutKey => {
  const {innerWidth, innerHeight} = window;

  const sidebarWidth = parseInt(
    collapsed ? SIDEBAR_COLLAPSED_WIDTH : SIDEBAR_EXPANDED_WIDTH,
    10
  );

  const mediumScreenWidth = parseInt(theme.breakpoints.medium, 10);

  const windowsWidth =
    innerWidth <= mediumScreenWidth ? innerWidth : innerWidth - sidebarWidth;

  if (windowsWidth < innerHeight) {
    return LayoutKey.TOPBAR;
  }

  return LayoutKey.SIDEBAR_LEFT;
};
