import theme from 'sentry/utils/theme';
import {LayoutModes} from 'sentry/views/replays/detail/layout';

const RECOMMENDED_WIDTH = 1700;
const MIN_RECOMMENDED_WIDTH = 1024;
const MIN_RECOMMENDED_HEIGHT = 960;

export const getDefaultLayout = (): LayoutModes => {
  const {innerWidth, innerHeight} = window;
  const sidebarWidth = parseInt(theme.sidebar.expandedWidth, 10);
  const windowsWidth = innerWidth - sidebarWidth;

  if (windowsWidth < innerHeight) {
    return 'topbar';
  }

  if (innerHeight > MIN_RECOMMENDED_HEIGHT && windowsWidth < RECOMMENDED_WIDTH) {
    return 'topbar';
  }

  if (windowsWidth < MIN_RECOMMENDED_WIDTH) {
    return 'topbar';
  }

  return 'sidebar_left';
};
