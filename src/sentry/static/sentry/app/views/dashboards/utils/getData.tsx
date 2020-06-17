import {t} from 'app/locale';
import {Widget} from 'app/types';
import {SnubaResult} from 'app/views/discover/types';

import {WIDGET_DISPLAY} from '../constants';
import {getChartDataFunc} from './getChartDataFunc';
import {isTimeSeries} from './isTimeSeries';

// TODO(billy): Currently only supports discover queries
export function getData(results: SnubaResult[], widget: Widget) {
  const {type, queries, yAxisMapping} = widget;
  const isTable = type === WIDGET_DISPLAY.TABLE;
  const [chartDataFunc, chartDataFuncArgs] = getChartDataFunc(widget);
  const hasYAxes = yAxisMapping && yAxisMapping.length === 2;

  if (isTable) {
    const [series] = chartDataFunc(
      results[0].data,
      queries.discover[0],
      ...chartDataFuncArgs
    );

    return {
      title: t('Name'),
      countTitle: t('Events'),
      data: series.data,
    };
  }

  let series = results
    .map((result, i) =>
      chartDataFunc(result.data, queries.discover[i], {
        ...chartDataFuncArgs,
        formatVersion: true,
      })
    )
    .reduce((acc, s) => [...acc, ...s], []);

  // Has 2 y axes
  if (hasYAxes) {
    yAxisMapping?.forEach((mappings, yAxisIndex) => {
      mappings.forEach(seriesIndex => {
        if (typeof series[seriesIndex] === 'undefined') {
          return;
        }

        series[seriesIndex].yAxisIndex = yAxisIndex;
      });
    });
  }

  let previousPeriod = null;
  // XXX(billy): Probably will need to be more generic in future
  // Instead of simply doubling period for previous period
  // we'll want to a second query with a specific period. that way
  // we can compare to "this time last month" (or anything else besides the very last period)
  if (widget.includePreviousPeriod) {
    // `series` is an array of series objects
    // need to map through each one and split up data into 2 series objects
    // (one for previous period and one for the current period)
    [previousPeriod, series] = series
      .map(({data, seriesName, ...rest}) => {
        // Split data into halves
        const previousPeriodData = data.slice(0, Math.ceil(data.length / 2));
        const currentPeriodData = data.slice(Math.floor(data.length / 2));

        return [
          {
            seriesName: `${seriesName} (Previous Period)`,
            data: previousPeriodData.map(({name, value}, index) => ({
              value,
              originalTimestamp: name,
              name: currentPeriodData[index].name,
            })),
            ...rest,
          },
          {
            seriesName,
            data: currentPeriodData,
            ...rest,
          },
        ];
      })
      .reduce(
        // reduce down to a tuple of [PreviousPeriodSeriesObj[], CurrentPeriodSeriesObj[]]
        ([accPrev, accSeries], [prev, currentSeries]) => [
          [...accPrev, prev],
          [...accSeries, currentSeries],
        ],
        [[], []]
      );
  }

  const isTime = queries.discover.some(isTimeSeries);
  return {
    isGroupedByDate: isTime,
    xAxis: {...(!isTime && {truncate: 80})},
    grid: {
      left: '16px',
      right: '16px',
    },
    series,
    previousPeriod,
    yAxes: hasYAxes,
  };
}
