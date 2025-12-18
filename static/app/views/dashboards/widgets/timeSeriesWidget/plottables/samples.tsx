import type {Theme} from '@emotion/react';
import * as Sentry from '@sentry/react';
import type {EChartsType, ScatterSeriesOption, SeriesOption} from 'echarts';

import {t} from 'sentry/locale';
import type {ReactEchartsRef} from 'sentry/types/echarts';
import isValidDate from 'sentry/utils/date/isValidDate';
import type {DurationUnit, RateUnit, SizeUnit} from 'sentry/utils/discover/fields';
import {scaleTabularDataColumn} from 'sentry/utils/tabularData/scaleTabularDataColumn';
import {ECHARTS_MISSING_DATA_VALUE} from 'sentry/utils/timeSeries/timeSeriesItemToEChartsDataPoint';
import {isAPlottableTimeSeriesValueType} from 'sentry/views/dashboards/widgets/common/typePredicates';
import type {
  TabularData,
  TabularRow,
  TabularValueUnit,
  TimeSeriesValueUnit,
} from 'sentry/views/dashboards/widgets/common/types';
import {FALLBACK_TYPE} from 'sentry/views/dashboards/widgets/timeSeriesWidget/settings';
import {getSampleChartSymbol} from 'sentry/views/insights/common/views/spanSummaryPage/sampleList/durationChart/getSampleChartSymbol';
import {crossIconPath} from 'sentry/views/insights/common/views/spanSummaryPage/sampleList/durationChart/symbol';

import {BaselineMarkLine} from './baselineMarkline';
import type {Plottable, PlottableTimeSeriesValueType} from './plottable';

const {error, warn} = Sentry.logger;

type ScatterPlotDatum = [timestamp: string, value: number, id: string];

type ValidSampleRow = {
  [key: string]: string | number | null;
  id: string;
  timestamp: string;
};

type SamplesConfig = {
  /**
   * The name of the data attribute to plot. This should be one of the keys in the data that's available in the `samples` parameter that's passed to the constructor.
   */
  attributeName: string;
  /**
   * Optional alias. If not provided, the series name in the legend will use a default.
   */
  alias?: string;
  /**
   * Label for the markline that shows the `baselineValue`, if one is provided. Otherwise uses a fallback.
   */
  baselineLabel?: string;
  /**
   * A baseline value. If provided, the plottable will add a markline to indicate this baseline. Values above and below this baseline will be highlighted accordingly.
   */
  baselineValue?: number;
  /**
   * Callback for ECharts' `onClick` mouse event. Called with the sample that corresponds to the clicked sample in the chart
   */
  onClick?: (datum: ValidSampleRow) => void;
  /**
   * Callback for ECharts' `onDownplay`. Called with the sample that corresponds to the downplayed sample in the chart.
   */
  onDownplay?: (datum: ValidSampleRow) => void;
  /**
   * Callback for ECharts' `onHighlight`. Called with the sample that corresponds to the highlighted sample in the chart.
   */
  onHighlight?: (datum: ValidSampleRow) => void;
};

type SamplesPlottingOptions = {
  /**
   * The current theme.
   */
  theme: Theme;
  /**
   * Final plottable unit. This might be different from the original unit of the data, because we scale all time series to a single common unit.
   */
  unit: DurationUnit | SizeUnit | RateUnit | null;
};

/**
 * `Samples` is a plottable that represents discontinous individual measurements. These are usually overlaid on top of a continuous aggregate time series.
 */
export class Samples implements Plottable {
  sampleTableData: Readonly<TabularData>;
  #timestamps: readonly number[];
  config: Readonly<SamplesConfig>;
  chartRef?: ReactEchartsRef;

  constructor(samples: TabularData, config: SamplesConfig) {
    this.sampleTableData = samples;
    this.#timestamps = samples.data
      .filter(isValidSampleRow)
      .map(sample => new Date(sample.timestamp).getTime())
      .toSorted();
    this.config = config;
  }

  handleChartRef(chartRef: ReactEchartsRef) {
    this.chartRef = chartRef;
  }

  /**
   * Dispatch an action on a data point to the chart instance, if possible. If not possible, log the error, but noop. In all current cases, failing to dispatch an action is harmless, and only happens if the chart is removed from the DOM, in which case there's nothing to dispatch to, anyway. Telemetry added in case this happens a lot and we want to track down what's dispatching actions to a removed chart.
   */
  #dispatchPointAction(action: string, dataIndex: number): void {
    let chart: EChartsType | undefined = undefined;

    try {
      chart = this.chartRef?.getEchartsInstance();
    } catch (e) {
      warn(
        '`Samples` could not dispatch action because the chart was removed from the DOM'
      );
      return undefined;
    }

    if (!chart) {
      return undefined;
    }

    chart.dispatchAction({type: action, seriesName: this.name, dataIndex});
    return undefined;
  }

  highlight(sample: TabularRow) {
    if (sample && isValidSampleRow(sample)) {
      const dataIndex = this.sampleTableData.data.indexOf(sample);
      this.#dispatchPointAction('highlight', dataIndex);
    }
  }

  downplay(sample: TabularRow) {
    if (sample && isValidSampleRow(sample)) {
      const dataIndex = this.sampleTableData.data.indexOf(sample);
      this.#dispatchPointAction('downplay', dataIndex);
    }
  }

  get isEmpty(): boolean {
    return this.sampleTableData.data.every(
      sample => sample[this.config.attributeName] === null
    );
  }

  get needsColor(): boolean {
    return false;
  }

  get dataType(): PlottableTimeSeriesValueType {
    const type = this.sampleTableData.meta.fields[this.config?.attributeName];

    return isAPlottableTimeSeriesValueType(type) ? type : FALLBACK_TYPE;
  }

  get dataUnit(): TimeSeriesValueUnit {
    return this.sampleTableData.meta.units[this.config.attributeName] ?? null;
  }

  get start(): number | null {
    return this.#timestamps.at(0) ?? null;
  }

  get end(): number | null {
    return this.#timestamps.at(-1) ?? null;
  }

  get name(): string {
    return `${this.config.attributeName} samples`;
  }

  get label(): string {
    return this.config?.alias ?? t('%s Samples', this.config.attributeName);
  }

  scaleAttributeToUnit(destinationUnit: TabularValueUnit): TabularData {
    if (this.isEmpty) {
      return this.sampleTableData;
    }

    return scaleTabularDataColumn(
      this.sampleTableData,
      this.config.attributeName,
      destinationUnit
    );
  }

  constrainSamples(
    boundaryStart: Date | null,
    boundaryEnd: Date | null
  ): Readonly<TabularData> {
    return {
      ...this.sampleTableData,
      data: this.sampleTableData.data.filter(sample => {
        const timestampValue = sample.timestamp;
        // @ts-expect-error: TypeScript pretends like `Date` doesn't accept `undefined`, but it does
        const ts = new Date(timestampValue);

        if (!isValidDate(ts)) {
          return false;
        }

        return (
          (!boundaryStart || ts >= boundaryStart) && (!boundaryEnd || ts <= boundaryEnd)
        );
      }),
    };
  }

  #getSampleByIndex(dataIndex: number): ValidSampleRow | undefined {
    const sample = this.sampleTableData.data.at(dataIndex);

    if (!sample) {
      error('`Samples` plottable data out-of-range error', {
        dataIndex,
      });
      return undefined;
    }

    if (!isValidSampleRow(sample)) {
      warn('`Samples` plottable `onHighlight` almost received an invalid row', {
        dataIndex,
      });
      return undefined;
    }

    return sample;
  }

  onClick(dataIndex: number): void {
    const {config} = this;

    const sample = this.#getSampleByIndex(dataIndex);
    if (sample) {
      config.onClick?.(sample);
    }
  }

  onHighlight(dataIndex: number): void {
    const {config} = this;

    const sample = this.#getSampleByIndex(dataIndex);
    if (sample) {
      config.onHighlight?.(sample);
    }
  }

  onDownplay(dataIndex: number): void {
    const {config} = this;

    const sample = this.#getSampleByIndex(dataIndex);
    if (sample) {
      config.onDownplay?.(sample);
    }
  }

  toSeries(plottingOptions: SamplesPlottingOptions): SeriesOption[] {
    const {sampleTableData: samples, config} = this;
    const {theme} = plottingOptions;

    const series: ScatterSeriesOption = {
      type: 'scatter',
      name: this.name,
      data: samples.data.filter(isValidSampleRow).map(sample => {
        const value = sample[config.attributeName];
        const timestamp = new Date(sample.timestamp).getTime();
        return [timestamp, value ?? ECHARTS_MISSING_DATA_VALUE, sample.id];
      }),
      symbol: (value: ScatterPlotDatum) => {
        const {symbol} = config.baselineValue
          ? getSampleChartSymbol(value[1], config.baselineValue, theme)
          : {symbol: crossIconPath};

        return symbol;
      },
      markLine: config.baselineValue
        ? BaselineMarkLine({
            theme,
            value: config.baselineValue,
            label: config.baselineLabel,
          })
        : undefined,
      animation: false,
      emphasis: {
        scale: 1.2,
      },
      symbolSize: 14,
      itemStyle: {
        color: callbackValue => {
          const value = (callbackValue.data as ScatterPlotDatum)[1];

          const {color} = config.baselineValue
            ? getSampleChartSymbol(value, config.baselineValue, theme)
            : {color: theme.colors.gray800};
          return color;
        },
      },
    };

    return [series];
  }
}

function isValidSampleRow(row: TabularRow): row is ValidSampleRow {
  // Even though `TimeSeries` objects expect `timestamp` to be milliseconds
  // since the Unix epoch, tabular data doesn't follow that convention. Instead
  // we're looking for an ISO8601 string.
  if (typeof row.id === 'string' && typeof row.timestamp === 'string') {
    return true;
  }

  return false;
}
