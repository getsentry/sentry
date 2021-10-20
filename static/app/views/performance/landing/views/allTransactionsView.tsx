import {usePageError} from 'app/utils/performance/contexts/pageError';

import Table from '../../table';
import {DoubleChartRow, TripleChartRow} from '../widgets/components/widgetChartRow';
import {PerformanceWidgetSetting} from '../widgets/widgetDefinitions';

import {BasePerformanceViewProps} from './types';

export function AllTransactionsView(props: BasePerformanceViewProps) {
  return (
    <div>
      <TripleChartRow
        {...props}
        allowedCharts={[
          PerformanceWidgetSetting.USER_MISERY_AREA,
          PerformanceWidgetSetting.TPM_AREA,
          PerformanceWidgetSetting.FAILURE_RATE_AREA,
          PerformanceWidgetSetting.APDEX_AREA,
          PerformanceWidgetSetting.P50_DURATION_AREA,
          PerformanceWidgetSetting.P95_DURATION_AREA,
          PerformanceWidgetSetting.P99_DURATION_AREA,
        ]}
      />
      <DoubleChartRow
        {...props}
        allowedCharts={[
          PerformanceWidgetSetting.TPM_AREA,
          PerformanceWidgetSetting.MOST_RELATED_ERRORS,
          PerformanceWidgetSetting.MOST_RELATED_ISSUES,
        ]}
      />
      <Table {...props} setError={usePageError().setPageError} />
    </div>
  );
}
