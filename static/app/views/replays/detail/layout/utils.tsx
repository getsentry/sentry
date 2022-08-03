import theme from 'sentry/utils/theme';
import {LayoutModes} from 'sentry/views/replays/detail/layout';

export const getDefaultLayout = (): LayoutModes => {
  const {innerWidth, innerHeight} = window;
  const sidebarWidth = parseInt(theme.sidebar.expandedWidth, 10);
  const windowsWidth = innerWidth - sidebarWidth;

  if (windowsWidth < 1024 || innerHeight > 950) {
    return 'topbar';
  }

  return 'sidebar_left';
};
