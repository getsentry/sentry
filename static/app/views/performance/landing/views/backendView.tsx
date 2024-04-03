import type {Organization} from 'sentry/types';
import type {MetricsEnhancedSettingContext} from 'sentry/utils/performance/contexts/metricsEnhancedSetting';
import {
  canUseMetricsData,
  useMEPSettingContext,
} from 'sentry/utils/performance/contexts/metricsEnhancedSetting';
import {usePageAlert} from 'sentry/utils/performance/contexts/pageAlert';
import {PerformanceDisplayProvider} from 'sentry/utils/performance/contexts/performanceDisplayContext';
import useOrganization from 'sentry/utils/useOrganization';

import Table from '../../table';
import {ProjectPerformanceType} from '../../utils';
import {BACKEND_COLUMN_TITLES} from '../data';
import {DoubleChartRow, TripleChartRow} from '../widgets/components/widgetChartRow';
import {filterAllowedChartsMetrics} from '../widgets/utils';
import {PerformanceWidgetSetting} from '../widgets/widgetDefinitions';

import type {BasePerformanceViewProps} from './types';

function getAllowedChartsSmall(
  props: BasePerformanceViewProps,
  mepSetting: MetricsEnhancedSettingContext,
  organization: Organization
) {
  let charts = [
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

  const hasTransactionSummaryCleanupFlag = organization.features.includes(
    'performance-transaction-summary-cleanup'
  );

  // user misery and apdex charts will be discontinued as me move to a span-centric architecture
  if (hasTransactionSummaryCleanupFlag) {
    charts = [
      PerformanceWidgetSetting.TPM_AREA,
      PerformanceWidgetSetting.FAILURE_RATE_AREA,
      PerformanceWidgetSetting.P50_DURATION_AREA,
      PerformanceWidgetSetting.P75_DURATION_AREA,
      PerformanceWidgetSetting.P95_DURATION_AREA,
      PerformanceWidgetSetting.P99_DURATION_AREA,
      PerformanceWidgetSetting.DURATION_HISTOGRAM,
    ];
  }

  return filterAllowedChartsMetrics(props.organization, charts, mepSetting);
}

export function BackendView(props: BasePerformanceViewProps) {
  const mepSetting = useMEPSettingContext();
  const {setPageError} = usePageAlert();
  const organization = useOrganization();

  const doubleChartRowCharts = [
    PerformanceWidgetSetting.SLOW_HTTP_OPS,
    PerformanceWidgetSetting.SLOW_DB_OPS,
  ];

  if (canUseMetricsData(props.organization)) {
    if (props.organization.features.includes('performance-new-trends')) {
      doubleChartRowCharts.push(PerformanceWidgetSetting.MOST_CHANGED);
    }

    if (props.organization.features.includes('performance-database-view')) {
      doubleChartRowCharts.unshift(PerformanceWidgetSetting.MOST_TIME_SPENT_DB_QUERIES);
    }
  } else {
    doubleChartRowCharts.push(
      ...[PerformanceWidgetSetting.MOST_REGRESSED, PerformanceWidgetSetting.MOST_IMPROVED]
    );
  }
  return (
    <PerformanceDisplayProvider value={{performanceType: ProjectPerformanceType.ANY}}>
      <div>
        <DoubleChartRow {...props} allowedCharts={doubleChartRowCharts} />
        <TripleChartRow
          {...props}
          allowedCharts={getAllowedChartsSmall(props, mepSetting, organization)}
        />
        <Table {...props} columnTitles={BACKEND_COLUMN_TITLES} setError={setPageError} />
      </div>
    </PerformanceDisplayProvider>
  );
}
