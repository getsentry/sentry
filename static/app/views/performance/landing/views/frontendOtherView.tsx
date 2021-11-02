import {usePageError} from 'app/utils/performance/contexts/pageError';
import {PerformanceDisplayProvider} from 'app/utils/performance/contexts/performanceDisplayContext';

import Table from '../../table';
import {PROJECT_PERFORMANCE_TYPE} from '../../utils';
import {FRONTEND_OTHER_COLUMN_TITLES} from '../data';
import {DoubleChartRow, TripleChartRow} from '../widgets/components/widgetChartRow';
import {PerformanceWidgetSetting} from '../widgets/widgetDefinitions';

import {BasePerformanceViewProps} from './types';

export function FrontendOtherView(props: BasePerformanceViewProps) {
  return (
    <PerformanceDisplayProvider
      value={{performanceType: PROJECT_PERFORMANCE_TYPE.FRONTEND_OTHER}}
    >
      <div>
        <TripleChartRow
          {...props}
          allowedCharts={[
            PerformanceWidgetSetting.TPM_AREA,
            PerformanceWidgetSetting.DURATION_HISTOGRAM,
            PerformanceWidgetSetting.P50_DURATION_AREA,
            PerformanceWidgetSetting.P95_DURATION_AREA,
            PerformanceWidgetSetting.P99_DURATION_AREA,
          ]}
        />
        <DoubleChartRow
          {...props}
          allowedCharts={[
            PerformanceWidgetSetting.MOST_RELATED_ERRORS,
            PerformanceWidgetSetting.MOST_RELATED_ISSUES,
          ]}
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
