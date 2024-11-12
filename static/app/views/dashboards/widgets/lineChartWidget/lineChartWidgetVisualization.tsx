import BaseChart from 'sentry/components/charts/baseChart';
import LineSeries from 'sentry/components/charts/series/lineSeries';
import {useChartZoom} from 'sentry/components/charts/useChartZoom';

import type {Meta, TimeseriesData} from '../common/types';

import {formatChartValue} from './formatChartValue';

export interface LineChartWidgetVisualizationProps {
  timeseries: TimeseriesData[];
  meta?: Meta;
  utc?: boolean;
}

export function LineChartWidgetVisualization(props: LineChartWidgetVisualizationProps) {
  const {timeseries, meta} = props;

  const chartZoomProps = useChartZoom({
    saveOnZoom: true,
  });

  // TODO: Raise error if attempting to plot series of different types or units
  const firstSeriesField = timeseries[0]?.field;
  const type = meta?.fields?.[firstSeriesField] ?? 'number';
  const unit = meta?.units?.[firstSeriesField] ?? undefined;

  return (
    <BaseChart
      series={timeseries.map(timeserie => {
        return LineSeries({
          name: timeserie.field,
          color: timeserie.color,
          animation: false,
          data: timeserie.data.map(datum => {
            return [datum.timestamp, datum.value];
          }),
        });
      })}
      utc={props.utc}
      legend={{
        top: 0,
        left: 0,
      }}
      showTimeInTooltip
      tooltip={{
        valueFormatter: value => {
          return formatChartValue(value, type, unit);
        },
      }}
      yAxis={{
        axisLabel: {
          formatter(value: number) {
            return formatChartValue(value, type, unit);
          },
        },
      }}
      {...chartZoomProps}
      isGroupedByDate
    />
  );
}
