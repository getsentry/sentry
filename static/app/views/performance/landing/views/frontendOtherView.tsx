import {useTheme} from '@emotion/react';

import type {MetricsEnhancedSettingContext} from 'sentry/utils/performance/contexts/metricsEnhancedSetting';
import {useMEPSettingContext} from 'sentry/utils/performance/contexts/metricsEnhancedSetting';
import {usePageAlert} from 'sentry/utils/performance/contexts/pageAlert';
import {PerformanceDisplayProvider} from 'sentry/utils/performance/contexts/performanceDisplayContext';
import {FRONTEND_OTHER_COLUMN_TITLES} from 'sentry/views/performance/landing/data';
import {
  DoubleChartRow,
  TripleChartRow,
} from 'sentry/views/performance/landing/widgets/components/widgetChartRow';
import {filterAllowedChartsMetrics} from 'sentry/views/performance/landing/widgets/utils';
import {PerformanceWidgetSetting} from 'sentry/views/performance/landing/widgets/widgetDefinitions';
import Table from 'sentry/views/performance/table';
import {ProjectPerformanceType} from 'sentry/views/performance/utils';

import type {BasePerformanceViewProps} from './types';

function getAllowedChartsSmall(
  props: BasePerformanceViewProps,
  mepSetting: MetricsEnhancedSettingContext
) {
  const charts = [
    PerformanceWidgetSetting.TPM_AREA,
    PerformanceWidgetSetting.DURATION_HISTOGRAM,
    PerformanceWidgetSetting.P50_DURATION_AREA,
    PerformanceWidgetSetting.P75_DURATION_AREA,
    PerformanceWidgetSetting.P95_DURATION_AREA,
    PerformanceWidgetSetting.P99_DURATION_AREA,
  ];

  return filterAllowedChartsMetrics(props.organization, charts, mepSetting);
}

export function FrontendOtherView(props: BasePerformanceViewProps) {
  const mepSetting = useMEPSettingContext();
  const {setPageError} = usePageAlert();
  const theme = useTheme();

  const doubleChartRowCharts = [
    PerformanceWidgetSetting.SLOW_HTTP_OPS,
    PerformanceWidgetSetting.SLOW_RESOURCE_OPS,
  ];

  if (props.organization.features.includes('insights-initial-modules')) {
    doubleChartRowCharts.unshift(PerformanceWidgetSetting.MOST_TIME_CONSUMING_DOMAINS);
    doubleChartRowCharts.unshift(PerformanceWidgetSetting.MOST_TIME_CONSUMING_RESOURCES);
    doubleChartRowCharts.unshift(PerformanceWidgetSetting.HIGHEST_OPPORTUNITY_PAGES);
  }

  return (
    <PerformanceDisplayProvider
      value={{performanceType: ProjectPerformanceType.FRONTEND_OTHER}}
    >
      <div data-test-id="frontend-other-view">
        <DoubleChartRow {...props} allowedCharts={doubleChartRowCharts} />
        <TripleChartRow
          {...props}
          allowedCharts={getAllowedChartsSmall(props, mepSetting)}
        />
        <Table
          {...props}
          columnTitles={FRONTEND_OTHER_COLUMN_TITLES}
          setError={setPageError}
          theme={theme}
        />
      </div>
    </PerformanceDisplayProvider>
  );
}
