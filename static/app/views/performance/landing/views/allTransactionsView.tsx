import {canUseMetricsData} from 'sentry/utils/performance/contexts/metricsEnhancedSetting';
import {usePageAlert} from 'sentry/utils/performance/contexts/pageAlert';
import {PerformanceDisplayProvider} from 'sentry/utils/performance/contexts/performanceDisplayContext';
import useOrganization from 'sentry/utils/useOrganization';

import Table from '../../table';
import {ProjectPerformanceType} from '../../utils';
import {DoubleChartRow, TripleChartRow} from '../widgets/components/widgetChartRow';
import {PerformanceWidgetSetting} from '../widgets/widgetDefinitions';

import type {BasePerformanceViewProps} from './types';

export function AllTransactionsView(props: BasePerformanceViewProps) {
  const {setPageError} = usePageAlert();
  const doubleChartRowCharts: PerformanceWidgetSetting[] = [];
  const organization = useOrganization();

  let allowedCharts = [
    PerformanceWidgetSetting.USER_MISERY_AREA,
    PerformanceWidgetSetting.TPM_AREA,
    PerformanceWidgetSetting.FAILURE_RATE_AREA,
    PerformanceWidgetSetting.APDEX_AREA,
    PerformanceWidgetSetting.P50_DURATION_AREA,
    PerformanceWidgetSetting.P75_DURATION_AREA,
    PerformanceWidgetSetting.P95_DURATION_AREA,
    PerformanceWidgetSetting.P99_DURATION_AREA,
  ];

  const hasTransactionSummaryCleanupFlag = organization.features.includes(
    'performance-transaction-summary-cleanup'
  );

  if (hasTransactionSummaryCleanupFlag) {
    allowedCharts = [
      PerformanceWidgetSetting.TPM_AREA,
      PerformanceWidgetSetting.FAILURE_RATE_AREA,
      PerformanceWidgetSetting.P50_DURATION_AREA,
      PerformanceWidgetSetting.P75_DURATION_AREA,
      PerformanceWidgetSetting.P95_DURATION_AREA,
      PerformanceWidgetSetting.P99_DURATION_AREA,
    ];
  }

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
        <TripleChartRow {...props} allowedCharts={allowedCharts} />
        <Table {...props} setError={setPageError} />
      </div>
    </PerformanceDisplayProvider>
  );
}
