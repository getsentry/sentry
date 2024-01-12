import {canUseMetricsData} from 'sentry/utils/performance/contexts/metricsEnhancedSetting';
import {usePageError} from 'sentry/utils/performance/contexts/pageError';
import {PerformanceDisplayProvider} from 'sentry/utils/performance/contexts/performanceDisplayContext';

import Table from '../../table';
import {ProjectPerformanceType} from '../../utils';
import {DoubleChartRow, TripleChartRow} from '../widgets/components/widgetChartRow';
import {PerformanceWidgetSetting} from '../widgets/widgetDefinitions';

import {BasePerformanceViewProps} from './types';

export function AllTransactionsView(props: BasePerformanceViewProps) {
  const doubleChartRowCharts: PerformanceWidgetSetting[] = [];

  if (
    props.organization.features.includes('performance-new-trends') &&
    canUseMetricsData(props.organization)
  ) {
    if (props.organization.features.includes('performance-database-view')) {
      doubleChartRowCharts.unshift(PerformanceWidgetSetting.MOST_RELATED_ISSUES);
      doubleChartRowCharts.unshift(PerformanceWidgetSetting.MOST_CHANGED);
      doubleChartRowCharts.unshift(PerformanceWidgetSetting.MOST_TIME_SPENT_DB_QUERIES);
    } else {
      doubleChartRowCharts.unshift(PerformanceWidgetSetting.MOST_CHANGED);
      doubleChartRowCharts.unshift(PerformanceWidgetSetting.MOST_RELATED_ISSUES);
    }

    if (
      props.organization.features.includes('starfish-browser-webvitals-pageoverview-v2')
    ) {
      doubleChartRowCharts.unshift(PerformanceWidgetSetting.OVERALL_PERFORMANCE_SCORE);
    }
  } else {
    doubleChartRowCharts.unshift(PerformanceWidgetSetting.MOST_REGRESSED);
    doubleChartRowCharts.push(PerformanceWidgetSetting.MOST_IMPROVED);
  }

  return (
    <PerformanceDisplayProvider value={{performanceType: ProjectPerformanceType.ANY}}>
      <div data-test-id="all-transactions-view">
        <DoubleChartRow {...props} allowedCharts={doubleChartRowCharts} />
        <TripleChartRow
          {...props}
          allowedCharts={[
            PerformanceWidgetSetting.USER_MISERY_AREA,
            PerformanceWidgetSetting.TPM_AREA,
            PerformanceWidgetSetting.FAILURE_RATE_AREA,
            PerformanceWidgetSetting.APDEX_AREA,
            PerformanceWidgetSetting.P50_DURATION_AREA,
            PerformanceWidgetSetting.P75_DURATION_AREA,
            PerformanceWidgetSetting.P95_DURATION_AREA,
            PerformanceWidgetSetting.P99_DURATION_AREA,
          ]}
        />
        <Table {...props} setError={usePageError().setPageError} />
      </div>
    </PerformanceDisplayProvider>
  );
}
