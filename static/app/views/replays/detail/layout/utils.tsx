import {layoutLabels} from 'sentry/utils/replays/hooks/useReplayLayout';
import theme from 'sentry/utils/theme';

type LayoutModes = keyof typeof layoutLabels;

export const getDefaultLayout = (collapsed: boolean): LayoutModes => {
  const {innerWidth, innerHeight} = window;

  const sidebarWidth = parseInt(
    collapsed ? theme.sidebar.collapsedWidth : theme.sidebar.expandedWidth,
    10
  );

  const mediumScreenWidth = parseInt(theme.breakpoints.medium, 10);

  const windowsWidth =
    innerWidth <= mediumScreenWidth ? innerWidth : innerWidth - sidebarWidth;

  if (windowsWidth < innerHeight) {
    return 'topbar';
  }

  return 'sidebar_left';
};
