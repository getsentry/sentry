import type {
  MarkAreaComponentOption,
  MarkLineComponentOption,
  SeriesOption,
} from 'echarts';

import MarkArea from 'sentry/components/charts/components/markArea';
import MarkLine from 'sentry/components/charts/components/markLine';
import {t} from 'sentry/locale';
import type {Theme} from 'sentry/utils/theme';
import type {
  Thresholds as ThresholdsConfig,
  TimeSeriesValueUnit,
} from 'sentry/views/dashboards/widgets/common/types';
import type {
  Plottable,
  PlottableTimeSeriesValueType,
} from 'sentry/views/dashboards/widgets/timeSeriesWidget/plottables/plottable';

type ThresholdPlottableOptions = {
  thresholds: ThresholdsConfig;
};

type ThresholdPlottablePlottingOptions = {
  theme: Theme;
};

export class Thresholds implements Plottable {
  maxOffset = 5; // The offset from the top of the chart (in pixels), of the max threshold
  thresholds: ThresholdsConfig;

  /** State variables required for Plottable interface */
  dataType: PlottableTimeSeriesValueType = 'duration';
  dataUnit: TimeSeriesValueUnit = null;
  isEmpty = false;
  name = '';
  needsColor = false;
  start: number | null = null;
  end: number | null = null;

  constructor(options: ThresholdPlottableOptions) {
    this.thresholds = options.thresholds;
    this.isEmpty = !this.thresholds.max_values.max1 && !this.thresholds.max_values.max2;
  }

  toMarkArea(yAxisRange: [number, number], style: MarkAreaComponentOption['itemStyle']) {
    const max = yAxisRange[1] === Infinity ? {y: this.maxOffset} : {yAxis: yAxisRange[1]};
    const min = {yAxis: yAxisRange[0]};

    return MarkArea({
      silent: true,
      itemStyle: style,
      data: [[max, min]],
    });
  }

  toMarkAreas(theme: Theme) {
    const {max1, max2} = this.thresholds.max_values;

    const markAreas = [
      this.toMarkArea([0, max1 ?? Infinity], {
        color: theme.colors.green400,
        opacity: 0.1,
      }),
    ];

    if (max1) {
      markAreas.push(
        this.toMarkArea([max1, max2 ?? Infinity], {
          color: theme.colors.yellow400,
          opacity: 0.1,
        })
      );
    }

    if (max2) {
      markAreas.push(
        this.toMarkArea([max2, Infinity], {
          color: theme.colors.red400,
          opacity: 0.1,
        })
      );
    }

    return markAreas;
  }

  toMarkLine(yAxis: number, label: string, style: MarkLineComponentOption['lineStyle']) {
    return MarkLine({
      animation: false,
      silent: true,
      lineStyle: style,
      label: {
        formatter: () => label,
        position: 'insideEndBottom',
        color: (style?.color as string) || undefined,
      },
      data: [
        yAxis === Infinity
          ? [
              {xAxis: 'max', y: this.maxOffset},
              {xAxis: 'min', y: this.maxOffset},
            ]
          : {yAxis},
      ],
    });
  }

  toMarkLines(theme: Theme) {
    const {max1, max2} = this.thresholds.max_values;

    const markLines = [
      this.toMarkLine(max1 ?? Infinity, t('Good'), {
        color: theme.colors.green400,
      }),
    ];

    if (max1) {
      markLines.push(
        this.toMarkLine(max2 ?? Infinity, t('Meh'), {
          color: theme.colors.yellow400,
        })
      );
    }

    if (max2) {
      markLines.push(
        this.toMarkLine(Infinity, t('Poor'), {
          color: theme.colors.red400,
        })
      );
    }

    return markLines;
  }

  toSeries({theme}: ThresholdPlottablePlottingOptions): SeriesOption[] {
    const markAreas = this.toMarkAreas(theme);
    const markLines = this.toMarkLines(theme);

    const markAreaSeries: SeriesOption[] = markAreas.map(markArea => ({
      type: 'line',
      markArea,
      name: this.name,
      data: [],
      color: (markArea?.itemStyle?.color as string) || undefined,
    }));

    const markLineSeries: SeriesOption[] = markLines.map(markLine => ({
      type: 'line',
      markLine,
      name: this.name,
      data: [],
      color: (markLine?.lineStyle?.color as string) || undefined,
    }));

    return [...markAreaSeries, ...markLineSeries];
  }
}
