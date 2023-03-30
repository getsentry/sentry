import {usePageError} from 'sentry/utils/performance/contexts/pageError';
import {PerformanceDisplayProvider} from 'sentry/utils/performance/contexts/performanceDisplayContext';

import Table from '../../table';
import {PROJECT_PERFORMANCE_TYPE} from '../../utils';
import {SingleChartRow, TripleChartRow} from '../widgets/components/widgetChartRow';
import {PerformanceWidgetSetting} from '../widgets/widgetDefinitions';

import {BasePerformanceViewProps} from './types';

export function StarfishView(props: BasePerformanceViewProps) {
  return (
    <PerformanceDisplayProvider value={{performanceType: PROJECT_PERFORMANCE_TYPE.ANY}}>
      <div data-test-id="starfish-view">
        <SingleChartRow
          {...props}
          allowedCharts={[PerformanceWidgetSetting.DB_HTTP_BREAKDOWN]}
        />
        <TripleChartRow
          {...props}
          allowedCharts={[
            PerformanceWidgetSetting.TPM_AREA,
            PerformanceWidgetSetting.FAILURE_RATE_AREA,
            PerformanceWidgetSetting.P95_DURATION_AREA,
          ]}
        />
        <Table {...props} setError={usePageError().setPageError} />
      </div>
    </PerformanceDisplayProvider>
  );
}
