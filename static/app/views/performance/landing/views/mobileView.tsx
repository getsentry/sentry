import {usePageError} from 'app/utils/performance/contexts/pageError';
import {PerformanceDisplayProvider} from 'app/utils/performance/contexts/performanceDisplayContext';

import Table from '../../table';
import {PROJECT_PERFORMANCE_TYPE} from '../../utils';
import {MOBILE_COLUMN_TITLES} from '../data';
import {DoubleChartRow, TripleChartRow} from '../widgets/components/widgetChartRow';
import {PerformanceWidgetSetting} from '../widgets/widgetDefinitions';

import {BasePerformanceViewProps} from './types';

export function MobileView(props: BasePerformanceViewProps) {
  return (
    <PerformanceDisplayProvider value={{performanceType: PROJECT_PERFORMANCE_TYPE.ANY}}>
      <div>
        <TripleChartRow
          {...props}
          allowedCharts={[
            PerformanceWidgetSetting.TPM_AREA,
            PerformanceWidgetSetting.COLD_STARTUP_AREA,
            PerformanceWidgetSetting.WARM_STARTUP_AREA,
            PerformanceWidgetSetting.SLOW_FRAMES_AREA,
            PerformanceWidgetSetting.FROZEN_FRAMES_AREA,
          ]}
        />
        <DoubleChartRow
          {...props}
          allowedCharts={[
            PerformanceWidgetSetting.MOST_SLOW_FRAMES,
            PerformanceWidgetSetting.MOST_FROZEN_FRAMES,
            PerformanceWidgetSetting.MOST_IMPROVED,
            PerformanceWidgetSetting.MOST_REGRESSED,
          ]}
        />
        <Table
          {...props}
          columnTitles={MOBILE_COLUMN_TITLES} // TODO(k-fish): Add react native column titles
          setError={usePageError().setPageError}
        />
      </div>
    </PerformanceDisplayProvider>
  );
}
