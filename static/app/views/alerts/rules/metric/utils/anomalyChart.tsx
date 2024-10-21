import type {MarkAreaComponentOption} from 'echarts';
import moment from 'moment-timezone';

import type {AreaChartSeries} from 'sentry/components/charts/areaChart';
import MarkLine from 'sentry/components/charts/components/markLine';
import ConfigStore from 'sentry/stores/configStore';
import {lightTheme as theme} from 'sentry/utils/theme';
import type {Anomaly} from 'sentry/views/alerts/types';
import {AnomalyType} from 'sentry/views/alerts/types';

export interface AnomalyMarkerSeriesOptions {
  endDate?: Date;
  startDate?: Date;
}

export function getAnomalyMarkerSeries(
  anomalies: Anomaly[],
  opts: AnomalyMarkerSeriesOptions = {}
): AreaChartSeries[] {
  const series: AreaChartSeries[] = [];
  if (!Array.isArray(anomalies) || anomalies.length === 0) {
    return series;
  }
  const {startDate, endDate} = opts;
  const filterPredicate = (anomaly: Anomaly): boolean => {
    const timestamp = new Date(anomaly.timestamp).getTime();
    if (startDate && endDate) {
      return startDate.getTime() < timestamp && timestamp < endDate.getTime();
    }
    if (startDate) {
      return startDate.getTime() < timestamp;
    }
    if (endDate) {
      return timestamp < endDate.getTime();
    }
    return true;
  };
  const anomalyBlocks: MarkAreaComponentOption['data'] = [];
  let start: string | undefined;
  let end: string | undefined;

  anomalies
    .filter(item => filterPredicate(item))
    .forEach(item => {
      const {anomaly, timestamp} = item;

      if (
        [AnomalyType.HIGH_CONFIDENCE, AnomalyType.LOW_CONFIDENCE].includes(
          anomaly.anomaly_type
        )
      ) {
        if (!start) {
          // If this is the start of an anomaly, set start
          start = getDateForTimestamp(timestamp).toISOString();
        }
        // as long as we have an valid anomaly type - continue tracking until we've hit the end
        end = getDateForTimestamp(timestamp).toISOString();
      } else {
        if (start && end) {
          // If we've hit a non-anomaly type, push the block
          anomalyBlocks.push([
            {
              xAxis: start,
            },
            {
              xAxis: end,
            },
          ]);
          // Create a marker line for the start of the anomaly
          series.push(createAnomalyMarkerSeries(theme.purple300, start));
        }
        // reset the start/end to capture the next anomaly block
        start = undefined;
        end = undefined;
      }
    });
  if (start && end) {
    // push in the last block
    // Create a marker line for the start of the anomaly
    series.push(createAnomalyMarkerSeries(theme.purple300, start));
    anomalyBlocks.push([
      {
        xAxis: start,
      },
      {
        xAxis: end,
      },
    ]);
  }

  // NOTE: if timerange is too small - highlighted area will not be visible
  // Possibly provide a minimum window size if the time range is too large?
  series.push({
    seriesName: '',
    name: 'Anomaly',
    type: 'line',
    smooth: true,
    data: [],
    markArea: {
      itemStyle: {
        color: 'rgba(255, 173, 177, 0.4)',
      },
      silent: true, // potentially don't make this silent if we want to render the `anomaly detected` in the tooltip
      data: anomalyBlocks,
    },
  });

  return series;
}

function createAnomalyMarkerSeries(
  lineColor: string,
  timestamp: string
): AreaChartSeries {
  const formatter = ({value}: any) => {
    const time = formatTooltipDate(moment(value), 'MMM D, YYYY LT');
    return [
      `<div class="tooltip-series"><div>`,
      `</div>Anomaly Detected</div>`,
      `<div class="tooltip-footer">${time}</div>`,
      '<div class="tooltip-arrow"></div>',
    ].join('');
  };

  return {
    seriesName: 'Anomaly Line',
    type: 'line',
    markLine: MarkLine({
      silent: false,
      lineStyle: {color: lineColor, type: 'dashed'},
      label: {
        silent: true,
        show: false,
      },
      data: [
        {
          xAxis: timestamp,
        },
      ],
      tooltip: {
        formatter,
      },
    }),
    data: [],
    tooltip: {
      trigger: 'item',
      alwaysShowContent: true,
      formatter,
    },
  };
}

function getDateForTimestamp(timestamp: string | number): Date {
  return new Date(typeof timestamp === 'string' ? timestamp : timestamp * 1000);
}

function formatTooltipDate(date: moment.MomentInput, format: string): string {
  const {
    options: {timezone},
  } = ConfigStore.get('user');
  return moment.tz(date, timezone).format(format);
}
