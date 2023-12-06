import {
  MetricsEnhancedSettingContext,
  useMEPSettingContext,
} from 'sentry/utils/performance/contexts/metricsEnhancedSetting';
import {usePageError} from 'sentry/utils/performance/contexts/pageError';
import {PerformanceDisplayProvider} from 'sentry/utils/performance/contexts/performanceDisplayContext';

import Table from '../../table';
import {ProjectPerformanceType} from '../../utils';
import {FRONTEND_OTHER_COLUMN_TITLES} from '../data';
import {DoubleChartRow, TripleChartRow} from '../widgets/components/widgetChartRow';
import {filterAllowedChartsMetrics} from '../widgets/utils';
import {PerformanceWidgetSetting} from '../widgets/widgetDefinitions';

import {BasePerformanceViewProps} from './types';

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

  const doubleChartRowCharts = [
    PerformanceWidgetSetting.SLOW_HTTP_OPS,
    PerformanceWidgetSetting.SLOW_RESOURCE_OPS,
  ];

  if (props.organization.features.includes('starfish-browser-resource-module-ui')) {
    doubleChartRowCharts.unshift(PerformanceWidgetSetting.MOST_TIME_CONSUMING_RESOURCES);
  }

  if (
    props.organization.features.includes('starfish-browser-webvitals-pageoverview-v2')
  ) {
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
          setError={usePageError().setPageError}
        />
      </div>
    </PerformanceDisplayProvider>
  );
}
