import {canUseMetricsData} from 'sentry/utils/performance/contexts/metricsEnhancedSetting';
import {usePageError} from 'sentry/utils/performance/contexts/pageError';
import {PerformanceDisplayProvider} from 'sentry/utils/performance/contexts/performanceDisplayContext';

import Table from '../../table';
import {ProjectPerformanceType} from '../../utils';
import {MOBILE_COLUMN_TITLES, REACT_NATIVE_COLUMN_TITLES} from '../data';
import {checkIsReactNative} from '../utils';
import {DoubleChartRow, TripleChartRow} from '../widgets/components/widgetChartRow';
import {PerformanceWidgetSetting} from '../widgets/widgetDefinitions';

import {BasePerformanceViewProps} from './types';

export function MobileView(props: BasePerformanceViewProps) {
  let columnTitles = checkIsReactNative(props.eventView)
    ? REACT_NATIVE_COLUMN_TITLES
    : MOBILE_COLUMN_TITLES;
  const {organization} = props;
  const allowedCharts = [
    PerformanceWidgetSetting.TPM_AREA,
    PerformanceWidgetSetting.USER_MISERY_AREA,
    PerformanceWidgetSetting.COLD_STARTUP_AREA,
    PerformanceWidgetSetting.WARM_STARTUP_AREA,
    PerformanceWidgetSetting.SLOW_FRAMES_AREA,
    PerformanceWidgetSetting.FROZEN_FRAMES_AREA,
  ];

  const doubleRowAllowedCharts = [
    PerformanceWidgetSetting.MOST_SLOW_FRAMES,
    PerformanceWidgetSetting.MOST_FROZEN_FRAMES,
  ];

  if (organization.features.includes('mobile-vitals')) {
    columnTitles = [...columnTitles.slice(0, 5), 'ttid', ...columnTitles.slice(5, 0)];
    allowedCharts.push(
      ...[
        PerformanceWidgetSetting.TIME_TO_INITIAL_DISPLAY,
        PerformanceWidgetSetting.TIME_TO_FULL_DISPLAY,
      ]
    );
  }
  if (organization.features.includes('performance-screens-view')) {
    doubleRowAllowedCharts[0] = PerformanceWidgetSetting.SLOW_SCREENS_BY_TTID;
  }
  if (
    organization.features.includes('performance-new-trends') &&
    canUseMetricsData(props.organization)
  ) {
    doubleRowAllowedCharts.push(PerformanceWidgetSetting.MOST_CHANGED);
  } else {
    doubleRowAllowedCharts.push(
      ...[PerformanceWidgetSetting.MOST_IMPROVED, PerformanceWidgetSetting.MOST_REGRESSED]
    );
  }
  return (
    <PerformanceDisplayProvider value={{performanceType: ProjectPerformanceType.ANY}}>
      <div>
        <DoubleChartRow {...props} allowedCharts={doubleRowAllowedCharts} />
        <TripleChartRow {...props} allowedCharts={allowedCharts} />
        <Table
          {...props}
          columnTitles={columnTitles}
          setError={usePageError().setPageError}
        />
      </div>
    </PerformanceDisplayProvider>
  );
}
