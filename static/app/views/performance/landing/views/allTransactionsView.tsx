import {usePageError} from 'app/utils/performance/contexts/pageError';

import Table from '../../table';
import {DoubleChartRow, MiniChartRow} from '../widgets/components/miniChartRow';
import {PerformanceWidgetSetting} from '../widgets/widgetDefinitions';

import {BasePerformanceViewProps} from './types';

export function AllTransactionsView(props: BasePerformanceViewProps) {
  return (
    <div>
      <MiniChartRow
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
          // TODO(k-fish): Temporarily adding extra charts here while trends widgets are in progress.
          PerformanceWidgetSetting.TPM_AREA,
          PerformanceWidgetSetting.TPM_AREA,
          PerformanceWidgetSetting.TPM_AREA,
          PerformanceWidgetSetting.MOST_IMPROVED,
          PerformanceWidgetSetting.MOST_REGRESSED,
        ]}
      />
      <Table {...props} setError={usePageError().setPageError} />
    </div>
  );
}
