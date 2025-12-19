import {useCallback} from 'react';

import useDrawer from 'sentry/components/globalDrawer';
import {t} from 'sentry/locale';
import {SlideoutId, type Widget} from 'sentry/views/dashboards/types';
import {PageOverviewWebVitalsDetailPanel} from 'sentry/views/insights/browser/webVitals/components/pageOverviewWebVitalsDetailPanel';
import {WebVitalsDetailPanel} from 'sentry/views/insights/browser/webVitals/components/webVitalsDetailPanel';
import type {WebVitals} from 'sentry/views/insights/browser/webVitals/types';

function getSlideoutComponent(widget: Widget): React.ReactNode | null {
  // We assume the slideout id (if it exists) is always on the first query
  const slideOutId = widget.queries[0]?.slideOutId;
  switch (slideOutId) {
    case SlideoutId.LCP:
    case SlideoutId.FCP:
    case SlideoutId.INP:
    case SlideoutId.CLS:
    case SlideoutId.TTFB:
      return <WebVitalsDetailPanel webVital={slideOutId as WebVitals} />;
    case SlideoutId.LCP_SUMMARY:
    case SlideoutId.FCP_SUMMARY:
    case SlideoutId.INP_SUMMARY:
    case SlideoutId.CLS_SUMMARY:
    case SlideoutId.TTFB_SUMMARY: {
      const webVital = slideOutId.split('-')[0] as WebVitals;
      // TODO: The PageOverviewWebVitalsDetailPanel currently filters
      // for a specific page name by checking url paramaters. This should
      // be updated so the page name filter can be obtained from the
      // widget and passed into PageOverviewWebVitalsDetailPanel. This
      // is so the component still works in dashboards where the url
      // params don't exist.
      return <PageOverviewWebVitalsDetailPanel webVital={webVital} />;
    }
    default:
      return null;
  }
}

export function useWidgetSlideout(widget: Widget) {
  // We assume the slideout id (if it exists) is always on the first query
  const slideOutId = widget.queries[0]?.slideOutId;

  const component = getSlideoutComponent(widget);

  const {openDrawer} = useDrawer();

  const handleWidgetClick = useCallback(() => {
    if (component !== null) {
      openDrawer(() => component, {ariaLabel: t('Slideout')});
    }
  }, [component, openDrawer]);

  return {
    hasSlideout: Boolean(slideOutId),
    onWidgetClick: handleWidgetClick,
  };
}
