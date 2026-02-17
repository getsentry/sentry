import type {SeriesOption} from 'echarts';

import MarkLine from 'sentry/components/charts/components/markLine';
import type {Theme} from 'sentry/utils/theme';
import type {TimeSeriesValueUnit} from 'sentry/views/dashboards/widgets/common/types';
import type {
  Plottable,
  PlottableTimeSeriesValueType,
} from 'sentry/views/dashboards/widgets/timeSeriesWidget/plottables/plottable';

type TimestampAnnotation = {
  timestamp: number;
  color?: string;
  label?: string;
  lineStyle?: 'solid' | 'dashed' | 'dotted';
};

type TimestampAnnotationsOptions = {
  annotations: TimestampAnnotation[];
};

type TimestampAnnotationsPlottingOptions = {
  theme: Theme;
};

export class TimestampAnnotations implements Plottable {
  annotations: TimestampAnnotation[];

  dataType: PlottableTimeSeriesValueType = 'duration';
  dataUnit: TimeSeriesValueUnit = null;
  isEmpty: boolean;
  name = '';
  needsColor = false;
  start: number | null = null;
  end: number | null = null;

  constructor(options: TimestampAnnotationsOptions) {
    this.annotations = options.annotations;
    this.isEmpty = this.annotations.length === 0;
  }

  toSeries({theme}: TimestampAnnotationsPlottingOptions): SeriesOption[] {
    if (this.isEmpty) {
      return [];
    }

    const markLine = MarkLine({
      animation: false,
      silent: true,
      data: this.annotations.map(annotation => ({
        xAxis: annotation.timestamp,
        lineStyle: {
          color: annotation.color ?? theme.colors.gray500,
          type: annotation.lineStyle ?? 'dashed',
        },
        label: annotation.label
          ? {
              show: true,
              formatter: () => annotation.label!,
              position: 'insideStartTop' as const,
              color: annotation.color ?? theme.colors.gray500,
            }
          : {
              show: false,
            },
      })),
    });

    return [
      {
        type: 'line',
        markLine,
        name: this.name,
        data: [],
      },
    ];
  }
}
