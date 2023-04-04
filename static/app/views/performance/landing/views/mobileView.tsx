import {usePageError} from 'sentry/utils/performance/contexts/pageError';
import {PerformanceDisplayProvider} from 'sentry/utils/performance/contexts/performanceDisplayContext';

import Table from '../../table';
import {PROJECT_PERFORMANCE_TYPE} from '../../utils';
import {MOBILE_COLUMN_TITLES, REACT_NATIVE_COLUMN_TITLES} from '../data';
import {checkIsReactNative} from '../utils';
import {DoubleChartRow, TripleChartRow} from '../widgets/components/widgetChartRow';
import {PerformanceWidgetSetting} from '../widgets/widgetDefinitions';

import {BasePerformanceViewProps} from './types';

export const MobileView = (props: BasePerformanceViewProps) => {
  let columnTitles = checkIsReactNative(props.eventView)
    ? REACT_NATIVE_COLUMN_TITLES
    : MOBILE_COLUMN_TITLES;
  const {organization} = props;
  const allowedCharts = [
    PerformanceWidgetSetting.TPM_AREA,
    PerformanceWidgetSetting.COLD_STARTUP_AREA,
    PerformanceWidgetSetting.WARM_STARTUP_AREA,
    PerformanceWidgetSetting.SLOW_FRAMES_AREA,
    PerformanceWidgetSetting.FROZEN_FRAMES_AREA,
  ];
  if (organization.features.includes('mobile-vitals')) {
    columnTitles = [...columnTitles.slice(0, 5), 'ttid', ...columnTitles.slice(5, 0)];
    allowedCharts.push(
      ...[
        PerformanceWidgetSetting.TIME_TO_INITIAL_DISPLAY,
        PerformanceWidgetSetting.TIME_TO_FULL_DISPLAY,
      ]
    );
  }
  return (
    <PerformanceDisplayProvider value={{performanceType: PROJECT_PERFORMANCE_TYPE.ANY}}>
      <div>
        <DoubleChartRow
          {...props}
          allowedCharts={[
            PerformanceWidgetSetting.MOST_SLOW_FRAMES,
            PerformanceWidgetSetting.MOST_FROZEN_FRAMES,
            PerformanceWidgetSetting.MOST_IMPROVED,
            PerformanceWidgetSetting.MOST_REGRESSED,
          ]}
        />
        <TripleChartRow {...props} allowedCharts={allowedCharts} />
        <Table
          {...props}
          columnTitles={columnTitles}
          setError={usePageError().setPageError}
        />
      </div>
    </PerformanceDisplayProvider>
  );
};
