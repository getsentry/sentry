// eslint-disable-next-line no-restricted-imports
import color from 'color';
import type {BarSeriesOption, LineSeriesOption} from 'echarts';

import {BarSeries} from 'sentry/components/charts/series/barSeries';
import type {ReactEchartsRef} from 'sentry/types/echarts';
import {formatXAxisValue} from 'sentry/views/dashboards/widgets/categoricalSeriesWidget/formatters/formatXAxisValue';
import type {
  CategoricalItem,
  CategoricalSeries,
} from 'sentry/views/dashboards/widgets/common/types';

import {
  CategoricalDataSeries,
  type CategoricalDataSeriesConfig,
  type CategoricalPlottingOptions,
} from './categoricalDataSeries';
import type {CategoricalPlottable} from './plottable';

interface BarsConfig extends CategoricalDataSeriesConfig {
  /**
   * Called when a bar is clicked.
   */
  onClick?: (item: CategoricalItem, dataIndex: number) => void;
  /**
   * Called when a bar is downplayed (mouse leaves).
   */
  onDownplay?: (item: CategoricalItem, dataIndex: number) => void;
  /**
   * Stack name. If provided, bar plottables with the same stack will be stacked visually.
   */
  stack?: string;
}

/**
 * A plottable that renders a categorical bar series.
 */
export class Bars
  // Will be fixed by https://github.com/typescript-eslint/typescript-eslint/pull/12206
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-arguments
  extends CategoricalDataSeries<BarsConfig>
  implements CategoricalPlottable
{
  constructor(categoricalSeries: CategoricalSeries, config: BarsConfig = {}) {
    super(categoricalSeries, config);
  }

  handleChartRef?: (ref: ReactEchartsRef) => void;

  onClick(dataIndex: number): void {
    const item = this.categoricalSeries.values[dataIndex];
    if (item && this.config?.onClick) {
      this.config.onClick(item, dataIndex);
    }
  }

  onHighlight(dataIndex: number): void {
    const item = this.categoricalSeries.values[dataIndex];
    if (item && this.config?.onHighlight) {
      this.config.onHighlight(item, dataIndex);
    }
  }

  onDownplay(dataIndex: number): void {
    const item = this.categoricalSeries.values[dataIndex];
    if (item && this.config?.onDownplay) {
      this.config.onDownplay(item, dataIndex);
    }
  }

  toSeries(
    plottingOptions: CategoricalPlottingOptions
  ): Array<BarSeriesOption | LineSeriesOption> {
    const colorOption = plottingOptions.color ?? this.config?.color ?? undefined;
    const colorObject = colorOption ? color(colorOption) : undefined;

    return [
      BarSeries({
        name: this.name,
        stack: this.config?.stack,
        yAxisIndex: 0,
        xAxisIndex: 0,
        color: colorOption,
        emphasis: {
          itemStyle: colorObject
            ? {
                color:
                  colorObject.luminosity() > 0.5
                    ? colorObject.darken(0.1).string()
                    : colorObject.lighten(0.1).string(),
              }
            : undefined,
        },
        animation: false,
        itemStyle: {
          opacity: 1,
        },
        data: this.categoricalSeries.values.map(
          item =>
            // This name must match with the `data` setting of the `xAxis` config
            // in ECharts. ECharts wants both a full list of the categories for
            // the X axis, and for the series data points to specify the name.
            [formatXAxisValue(item.category), item.value]
        ),
      }),
    ];
  }
}
