import React, {useState} from 'react';
import * as ReactRouter from 'react-router';

import ChartZoom from 'app/components/charts/chartZoom';
import ErrorPanel from 'app/components/charts/errorPanel';
import {PlatformKey} from 'app/data/platformCategories';
import {IconWarning} from 'app/icons';
import {GlobalSelection} from 'app/types';
import {Series} from 'app/types/echarts';
import HealthChart from 'app/views/releases/detail/overview/chart/healthChart';
import {YAxis} from 'app/views/releases/detail/overview/chart/releaseChartControls';
import {sortSessionSeries} from 'app/views/releases/detail/overview/chart/utils';
import {sessionTerm} from 'app/views/releases/utils/sessionTerm';

type Props = {
  title: string;
  chartData: Series[];
  isLoading: boolean;
  errored: boolean;
  selection: GlobalSelection;
  router: ReactRouter.InjectedRouter;
  platform: PlatformKey;
  errorMessage?: string;
  yAxis?: string;
};

function Chart({title, yAxis, chartData, errored, selection, router, platform}: Props) {
  const [shouldRecalculateVisibleSeries, setShouldRecalculateVisibleSeries] = useState(
    true
  );

  const {datetime} = selection;
  const {utc, period, start, end} = datetime;

  const timeseriesData = chartData.filter(({seriesName}) => {
    // There is no concept of Abnormal sessions in javascript
    if (
      (seriesName === sessionTerm.abnormal || seriesName === sessionTerm.otherAbnormal) &&
      ['javascript', 'node'].includes(platform)
    ) {
      return false;
    }

    return true;
  });

  return (
    <ChartZoom router={router} period={period} utc={utc} start={start} end={end}>
      {zoomRenderProps => {
        if (errored) {
          return (
            <ErrorPanel>
              <IconWarning color="gray300" size="lg" />
            </ErrorPanel>
          );
        }

        return (
          <HealthChart
            timeseriesData={timeseriesData.sort(sortSessionSeries)}
            zoomRenderProps={zoomRenderProps}
            reloading={false}
            yAxis={(yAxis ?? '') as YAxis}
            location={router.location}
            shouldRecalculateVisibleSeries={shouldRecalculateVisibleSeries}
            onVisibleSeriesRecalculated={() => setShouldRecalculateVisibleSeries(false)}
            platform={platform}
            title={title}
          />
        );
      }}
    </ChartZoom>
  );
}

export default Chart;
