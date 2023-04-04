import {
  canUseMetricsData,
  MetricsEnhancedSettingContext,
  useMEPSettingContext,
} from 'sentry/utils/performance/contexts/metricsEnhancedSetting';
import {usePageError} from 'sentry/utils/performance/contexts/pageError';
import {PerformanceDisplayProvider} from 'sentry/utils/performance/contexts/performanceDisplayContext';

import Table from '../../table';
import {PROJECT_PERFORMANCE_TYPE} from '../../utils';
import {BACKEND_COLUMN_TITLES} from '../data';
import {DoubleChartRow, TripleChartRow} from '../widgets/components/widgetChartRow';
import {filterAllowedChartsMetrics} from '../widgets/utils';
import {PerformanceWidgetSetting} from '../widgets/widgetDefinitions';

import {BasePerformanceViewProps} from './types';

function getAllowedChartsSmall(
  props: BasePerformanceViewProps,
  mepSetting: MetricsEnhancedSettingContext
) {
  const charts = [
    PerformanceWidgetSetting.APDEX_AREA,
    PerformanceWidgetSetting.TPM_AREA,
    PerformanceWidgetSetting.FAILURE_RATE_AREA,
    PerformanceWidgetSetting.USER_MISERY_AREA,
    PerformanceWidgetSetting.P50_DURATION_AREA,
    PerformanceWidgetSetting.P75_DURATION_AREA,
    PerformanceWidgetSetting.P95_DURATION_AREA,
    PerformanceWidgetSetting.P99_DURATION_AREA,
    PerformanceWidgetSetting.DURATION_HISTOGRAM,
  ];

  return filterAllowedChartsMetrics(props.organization, charts, mepSetting);
}

export const BackendView = (props: BasePerformanceViewProps) => {
  const mepSetting = useMEPSettingContext();
  const showSpanOperationsWidget =
    props.organization.features.includes('performance-new-widget-designs') &&
    canUseMetricsData(props.organization);

  const doubleChartRowCharts = [
    PerformanceWidgetSetting.SLOW_HTTP_OPS,
    PerformanceWidgetSetting.SLOW_DB_OPS,
    PerformanceWidgetSetting.MOST_IMPROVED,
    PerformanceWidgetSetting.MOST_REGRESSED,
  ];

  if (showSpanOperationsWidget) {
    doubleChartRowCharts.unshift(PerformanceWidgetSetting.SPAN_OPERATIONS);
  }
  return (
    <PerformanceDisplayProvider value={{performanceType: PROJECT_PERFORMANCE_TYPE.ANY}}>
      <div>
        <DoubleChartRow {...props} allowedCharts={doubleChartRowCharts} />
        <TripleChartRow
          {...props}
          allowedCharts={getAllowedChartsSmall(props, mepSetting)}
        />
        <Table
          {...props}
          columnTitles={BACKEND_COLUMN_TITLES}
          setError={usePageError().setPageError}
        />
      </div>
    </PerformanceDisplayProvider>
  );
};
