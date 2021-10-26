import {usePageError} from 'app/utils/performance/contexts/pageError';
import {PerformanceDisplayProvider} from 'app/utils/performance/contexts/performanceDisplayContext';

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
            PerformanceWidgetSetting.MOST_RELATED_ERRORS,
            PerformanceWidgetSetting.MOST_RELATED_ISSUES,
            PerformanceWidgetSetting.WORST_LCP_VITALS,
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
