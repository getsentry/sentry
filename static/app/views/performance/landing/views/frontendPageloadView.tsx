import {usePageError} from 'sentry/utils/performance/contexts/pageError';
import {PerformanceDisplayProvider} from 'sentry/utils/performance/contexts/performanceDisplayContext';

import Table from '../../table';
import {PROJECT_PERFORMANCE_TYPE} from '../../utils';
import {FRONTEND_PAGELOAD_COLUMN_TITLES} from '../data';
import {DoubleChartRow, TripleChartRow} from '../widgets/components/widgetChartRow';
import {PerformanceWidgetSetting} from '../widgets/widgetDefinitions';

import {BasePerformanceViewProps} from './types';

export function FrontendPageloadView(props: BasePerformanceViewProps) {
  return (
    <PerformanceDisplayProvider
      value={{performanceType: PROJECT_PERFORMANCE_TYPE.FRONTEND}}
    >
      <div data-test-id="frontend-pageload-view">
        <TripleChartRow
          {...props}
          allowedCharts={[
            PerformanceWidgetSetting.P75_LCP_AREA,
            PerformanceWidgetSetting.LCP_HISTOGRAM,
            PerformanceWidgetSetting.FCP_HISTOGRAM,
            PerformanceWidgetSetting.USER_MISERY_AREA,
            PerformanceWidgetSetting.TPM_AREA,
          ]}
        />
        <DoubleChartRow
          {...props}
          allowedCharts={[
            PerformanceWidgetSetting.WORST_LCP_VITALS,
            PerformanceWidgetSetting.WORST_FCP_VITALS,
            PerformanceWidgetSetting.WORST_FID_VITALS,
            PerformanceWidgetSetting.MOST_RELATED_ISSUES,
            PerformanceWidgetSetting.SLOW_HTTP_OPS,
            PerformanceWidgetSetting.SLOW_BROWSER_OPS,
            PerformanceWidgetSetting.SLOW_RESOURCE_OPS,
          ]}
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
