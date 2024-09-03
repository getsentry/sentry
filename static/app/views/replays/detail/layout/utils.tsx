import {LayoutKey} from 'sentry/utils/replays/hooks/useReplayLayout';
import theme from 'sentry/utils/theme';

export const getDefaultLayout = (collapsed: boolean, hasNewNav: boolean): LayoutKey => {
  const {innerWidth, innerHeight} = window;

  let width = collapsed ? theme.sidebar.collapsedWidth : theme.sidebar.expandedWidth;
  if (hasNewNav) {
    width = theme.sidebar.v2_width;
  }
  const sidebarWidth = parseInt(width, 10);

  const mediumScreenWidth = parseInt(theme.breakpoints.medium, 10);

  const windowsWidth =
    innerWidth <= mediumScreenWidth ? innerWidth : innerWidth - sidebarWidth;

  if (windowsWidth < innerHeight) {
    return LayoutKey.TOPBAR;
  }

  return LayoutKey.SIDEBAR_LEFT;
};
