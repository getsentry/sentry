import {canUseMetricsData} from 'sentry/utils/performance/contexts/metricsEnhancedSetting';
import {usePageError} from 'sentry/utils/performance/contexts/pageError';
import {PerformanceDisplayProvider} from 'sentry/utils/performance/contexts/performanceDisplayContext';
import {withMetricsTrendsCheck} from 'sentry/views/performance/trends/utils';

import Table from '../../table';
import {ProjectPerformanceType} from '../../utils';
import {DoubleChartRow, TripleChartRow} from '../widgets/components/widgetChartRow';
import {PerformanceWidgetSetting} from '../widgets/widgetDefinitions';

import {BasePerformanceViewProps} from './types';

function AllTransactionsViewContent(props: BasePerformanceViewProps) {
  const showSpanOperationsWidget =
    props.organization.features.includes('performance-new-widget-designs') &&
    canUseMetricsData(props.organization);

  const doubleChartRowCharts = [PerformanceWidgetSetting.MOST_RELATED_ISSUES];

  if (props.withMetricsTrends) {
    doubleChartRowCharts.unshift(PerformanceWidgetSetting.MOST_CHANGED);
  } else {
    doubleChartRowCharts.unshift(PerformanceWidgetSetting.MOST_REGRESSED);
    doubleChartRowCharts.push(PerformanceWidgetSetting.MOST_IMPROVED);
  }

  if (showSpanOperationsWidget) {
    doubleChartRowCharts.unshift(PerformanceWidgetSetting.SPAN_OPERATIONS);
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

export const AllTransactionsView = withMetricsTrendsCheck(AllTransactionsViewContent);
