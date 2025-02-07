import {SIDEBAR_COLLAPSED_WIDTH, SIDEBAR_EXPANDED_WIDTH} from 'sentry/components/sidebar';
import {LayoutKey} from 'sentry/utils/replays/hooks/useReplayLayout';
import theme from 'sentry/utils/theme';

export const getDefaultLayout = (collapsed: boolean): LayoutKey => {
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
