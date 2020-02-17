import {getChartDataForWidget, getChartDataByDay} from 'app/views/discover/result/utils';

import {WIDGET_DISPLAY} from '../constants';
import {isTimeSeries} from './isTimeSeries';

/**
 * Get data function based on widget properties
 */
export function getChartDataFunc({queries, type, fieldLabelMap}) {
  if (queries.discover.some(isTimeSeries)) {
    return [
      getChartDataByDay,
      [
        {
          allSeries: true,
          fieldLabelMap,
        },
      ],
    ];
  }

  return [
    getChartDataForWidget,
    [
      {
        includePercentages: type === WIDGET_DISPLAY.TABLE,
      },
    ],
  ];
}
