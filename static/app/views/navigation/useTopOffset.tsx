import {useTheme} from '@emotion/react';

import {useMedia} from 'sentry/utils/useMedia';
import {
  NAVIGATION_MOBILE_TOPBAR_HEIGHT_WITH_PAGE_FRAME,
  PRIMARY_HEADER_HEIGHT,
} from 'sentry/views/navigation/constants';

interface TopOffset {
  /** The total offset where content below the bar should start */
  contentTop: string;
}

export function useTopOffset(): TopOffset {
  const theme = useTheme();
  const isMobile = !useMedia(`(min-width: ${theme.breakpoints.md})`);
  const headerHeight = isMobile
    ? NAVIGATION_MOBILE_TOPBAR_HEIGHT_WITH_PAGE_FRAME
    : PRIMARY_HEADER_HEIGHT;

  return {
    contentTop: `${headerHeight}px`,
  };
}
