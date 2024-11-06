import BaseChart from 'sentry/components/charts/baseChart';
import LineSeries from 'sentry/components/charts/series/lineSeries';
import {defined} from 'sentry/utils';

import type {Meta, TimeseriesData} from '../common/types';

import {formatChartValue} from './formatChartValue';

export interface LineChartWidgetVisualizationProps {
  timeseries: TimeseriesData[];
  meta?: Meta;
}

export function LineChartWidgetVisualization(props: LineChartWidgetVisualizationProps) {
  const {meta} = props;

  return (
    <BaseChart
      series={props.timeseries.map(timeserie => {
        return LineSeries({
          name: timeserie.field,
          data: timeserie.data.map(datum => {
            return [datum.timestamp, datum.value];
          }),
        });
      })}
      showTimeInTooltip
      isGroupedByDate
      tooltip={{
        valueFormatter: (value, field) => {
          if (!defined(field)) {
            return renderLocaleString(value);
          }

          const unit = meta?.units?.[field];
          const type = meta?.fields?.[field] ?? 'number';

          return formatChartValue(value, type, unit ?? undefined);
        },
      }}
    />
  );
}

function renderLocaleString(value: number) {
  return value.toLocaleString();
}
