import {useTheme} from '@emotion/react';

import type {MetricsEnhancedSettingContext} from 'sentry/utils/performance/contexts/metricsEnhancedSetting';
import {useMEPSettingContext} from 'sentry/utils/performance/contexts/metricsEnhancedSetting';
import {usePageAlert} from 'sentry/utils/performance/contexts/pageAlert';
import {PerformanceDisplayProvider} from 'sentry/utils/performance/contexts/performanceDisplayContext';
import {FRONTEND_PAGELOAD_COLUMN_TITLES} from 'sentry/views/performance/landing/data';
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
    PerformanceWidgetSetting.P75_LCP_AREA,
    PerformanceWidgetSetting.LCP_HISTOGRAM,
    PerformanceWidgetSetting.FCP_HISTOGRAM,
    PerformanceWidgetSetting.USER_MISERY_AREA,
    PerformanceWidgetSetting.TPM_AREA,
  ];

  return filterAllowedChartsMetrics(props.organization, charts, mepSetting);
}

export function FrontendPageloadView(props: BasePerformanceViewProps) {
  const mepSetting = useMEPSettingContext();
  const {setPageError} = usePageAlert();
  const theme = useTheme();
  const doubleChartRowCharts = [
    PerformanceWidgetSetting.WORST_LCP_VITALS,
    PerformanceWidgetSetting.WORST_FCP_VITALS,
    PerformanceWidgetSetting.WORST_FID_VITALS,
    PerformanceWidgetSetting.SLOW_HTTP_OPS,
    PerformanceWidgetSetting.SLOW_BROWSER_OPS,
    PerformanceWidgetSetting.SLOW_RESOURCE_OPS,
  ];
  return (
    <PerformanceDisplayProvider
      value={{performanceType: ProjectPerformanceType.FRONTEND}}
    >
      <div data-test-id="frontend-pageload-view">
        <DoubleChartRow {...props} allowedCharts={doubleChartRowCharts} />
        <TripleChartRow
          {...props}
          allowedCharts={getAllowedChartsSmall(props, mepSetting)}
        />
        <Table
          {...props}
          theme={theme}
          columnTitles={FRONTEND_PAGELOAD_COLUMN_TITLES}
          setError={setPageError}
        />
      </div>
    </PerformanceDisplayProvider>
  );
}
