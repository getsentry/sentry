import {
  MetricsEnhancedSettingContext,
  useMEPSettingContext,
} from 'sentry/utils/performance/contexts/metricsEnhancedSetting';
import {usePageError} from 'sentry/utils/performance/contexts/pageError';
import {PerformanceDisplayProvider} from 'sentry/utils/performance/contexts/performanceDisplayContext';

import Table from '../../table';
import {ProjectPerformanceType} from '../../utils';
import {FRONTEND_PAGELOAD_COLUMN_TITLES} from '../data';
import {DoubleChartRow, TripleChartRow} from '../widgets/components/widgetChartRow';
import {filterAllowedChartsMetrics} from '../widgets/utils';
import {PerformanceWidgetSetting} from '../widgets/widgetDefinitions';

import {BasePerformanceViewProps} from './types';

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
          columnTitles={FRONTEND_PAGELOAD_COLUMN_TITLES}
          setError={usePageError().setPageError}
        />
      </div>
    </PerformanceDisplayProvider>
  );
}
