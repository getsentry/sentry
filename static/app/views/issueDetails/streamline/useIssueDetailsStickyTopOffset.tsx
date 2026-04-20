import {
  NAVIGATION_MOBILE_TOPBAR_HEIGHT,
  NAVIGATION_MOBILE_TOPBAR_HEIGHT_WITH_PAGE_FRAME,
  PRIMARY_HEADER_HEIGHT,
} from 'sentry/views/navigation/constants';
import {usePrimaryNavigation} from 'sentry/views/navigation/primaryNavigationContext';
import {useHasPageFrameFeature} from 'sentry/views/navigation/useHasPageFrameFeature';
import {useTopOffset} from 'sentry/views/navigation/useTopOffset';

export function useIssueDetailsStickyTopOffset(): number {
  const hasPageFrame = useHasPageFrameFeature();
  const {layout} = usePrimaryNavigation();
  const topOffset = Number.parseInt(useTopOffset(), 10) || 0;

  if (!hasPageFrame) {
    return layout === 'mobile' ? NAVIGATION_MOBILE_TOPBAR_HEIGHT : 0;
  }

  return (
    topOffset +
    (layout === 'mobile'
      ? NAVIGATION_MOBILE_TOPBAR_HEIGHT_WITH_PAGE_FRAME
      : PRIMARY_HEADER_HEIGHT)
  );
}
