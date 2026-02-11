import {useCallback} from 'react';

import useDrawer from 'sentry/components/globalDrawer';
import {t} from 'sentry/locale';
import {
  SlideoutId,
  type DashboardFilters,
  type Widget,
} from 'sentry/views/dashboards/types';
import {PageOverviewWebVitalsDetailPanel} from 'sentry/views/insights/browser/webVitals/components/pageOverviewWebVitalsDetailPanel';
import {WebVitalsDetailPanel} from 'sentry/views/insights/browser/webVitals/components/webVitalsDetailPanel';
import type {WebVitals} from 'sentry/views/insights/browser/webVitals/types';

function getSlideoutComponent(
  slideOutId: SlideoutId,
  dashboardFilters?: DashboardFilters
): React.ReactNode | null {
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
      return (
        <PageOverviewWebVitalsDetailPanel
          webVital={webVital}
          dashboardFilters={dashboardFilters}
        />
      );
    }
    default:
      return null;
  }
}

export function useWidgetSlideout(widget: Widget, dashboardFilters?: DashboardFilters) {
  // We assume the slideout id (if it exists) is always on the first query
  const slideOutId = widget.queries[0]?.slideOutId;

  const component = slideOutId
    ? getSlideoutComponent(slideOutId, dashboardFilters)
    : null;

  const {openDrawer} = useDrawer();

  const handleWidgetClick = useCallback(() => {
    if (component !== null) {
      openDrawer(() => component, {ariaLabel: t('Slideout')});
    }
  }, [component, openDrawer]);

  return {
    hasSlideout: Boolean(slideOutId) && component !== null,
    onWidgetClick: handleWidgetClick,
  };
}
