import type {Theme} from '@emotion/react';

import {LayoutKey} from 'sentry/utils/replays/hooks/useReplayLayout';
import {PRIMARY_SIDEBAR_WIDTH} from 'sentry/views/nav/constants';

export const getDefaultLayout = (
  collapsed: boolean,
  theme: Theme,
  secondarySidebarWidth: number
): LayoutKey => {
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
};
