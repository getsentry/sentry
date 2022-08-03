import theme from 'sentry/utils/theme';
import {LayoutModes} from 'sentry/views/replays/detail/layout';

export const getDefaultLayout = (): LayoutModes => {
  const {innerWidth, innerHeight} = window;
  const sidebarWidth = parseInt(theme.sidebar.expandedWidth, 10);
  const windowsWidth = innerWidth - sidebarWidth;

  if (innerHeight > 960 && windowsWidth < 1700) {
    return 'topbar';
  }

  if (windowsWidth < 1024) {
    return 'topbar';
  }

  return 'sidebar_left';
};
