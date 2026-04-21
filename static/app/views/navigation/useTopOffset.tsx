import {useTheme} from '@emotion/react';

import {ConfigStore} from 'sentry/stores/configStore';
import {HookStore} from 'sentry/stores/hookStore';
import {isActiveSuperuser} from 'sentry/utils/isActiveSuperuser';
import {useMedia} from 'sentry/utils/useMedia';
import {useOrganization} from 'sentry/utils/useOrganization';
import {
  NAVIGATION_MOBILE_TOPBAR_HEIGHT,
  NAVIGATION_MOBILE_TOPBAR_HEIGHT_WITH_PAGE_FRAME,
  PRIMARY_HEADER_HEIGHT,
  SUPERUSER_MARQUEE_HEIGHT,
} from 'sentry/views/navigation/constants';
import {useHasPageFrameFeature} from 'sentry/views/navigation/useHasPageFrameFeature';

interface TopOffset {
  /** The `top` CSS value for the sticky bar itself */
  barTop: string;
  /** The total offset where content below the bar should start */
  contentTop: string;
}

export function useTopOffset(): TopOffset {
  const theme = useTheme();
  const hasPageFrame = useHasPageFrameFeature();
  const organization = useOrganization({allowNull: true});
  const isMobile = !useMedia(`(min-width: ${theme.breakpoints.md})`);
  const showSuperuserWarning =
    hasPageFrame &&
    isActiveSuperuser() &&
    !ConfigStore.get('isSelfHosted') &&
    !HookStore.get('component:superuser-warning-excluded')[0]?.(organization);

  if (!hasPageFrame) {
    return {
      barTop: '0px',
      contentTop: `${isMobile ? NAVIGATION_MOBILE_TOPBAR_HEIGHT : 0}px`,
    };
  }

  const superuserOffset = showSuperuserWarning ? SUPERUSER_MARQUEE_HEIGHT : 0;
  const headerHeight = isMobile
    ? NAVIGATION_MOBILE_TOPBAR_HEIGHT_WITH_PAGE_FRAME
    : PRIMARY_HEADER_HEIGHT;

  return {
    barTop: `${superuserOffset}px`,
    contentTop: `${superuserOffset + headerHeight}px`,
  };
}
