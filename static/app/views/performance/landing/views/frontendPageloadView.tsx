import {usePageError} from 'app/utils/performance/contexts/pageError';

import Table from '../../table';
import {FRONTEND_PAGELOAD_COLUMN_TITLES} from '../data';
import {DoubleChartRow} from '../widgets/components/widgetChartRow';
import {PerformanceWidgetSetting} from '../widgets/widgetDefinitions';

import {BasePerformanceViewProps} from './types';

export function FrontendPageloadView(props: BasePerformanceViewProps) {
  return (
    <div data-test-id="frontend-pageload-view">
      <DoubleChartRow
        {...props}
        allowedCharts={[
          PerformanceWidgetSetting.TPM_AREA,
          PerformanceWidgetSetting.MOST_RELATED_ERRORS,
          PerformanceWidgetSetting.WORST_LCP_VITALS,
        ]}
      />
      <Table
        {...props}
        columnTitles={FRONTEND_PAGELOAD_COLUMN_TITLES}
        setError={usePageError().setPageError}
      />
    </div>
  );
}
