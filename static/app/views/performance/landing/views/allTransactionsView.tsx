import {usePageError} from 'sentry/utils/performance/contexts/pageError';
import {PerformanceDisplayProvider} from 'sentry/utils/performance/contexts/performanceDisplayContext';

import Table from '../../table';
import {PROJECT_PERFORMANCE_TYPE} from '../../utils';
import {DoubleChartRow, TripleChartRow} from '../widgets/components/widgetChartRow';
import {PerformanceWidgetSetting} from '../widgets/widgetDefinitions';

import {BasePerformanceViewProps} from './types';

export function AllTransactionsView(props: BasePerformanceViewProps) {
  return (
    <PerformanceDisplayProvider value={{performanceType: PROJECT_PERFORMANCE_TYPE.ANY}}>
      <div data-test-id="all-transactions-view">
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
        <DoubleChartRow
          {...props}
          allowedCharts={[
            PerformanceWidgetSetting.MOST_RELATED_ISSUES,
            PerformanceWidgetSetting.MOST_IMPROVED,
            PerformanceWidgetSetting.MOST_REGRESSED,
          ]}
        />
        <Table {...props} setError={usePageError().setPageError} />
      </div>
    </PerformanceDisplayProvider>
  );
}
