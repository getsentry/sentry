import type {Theme} from '@emotion/react';
import * as Sentry from '@sentry/react';
import type {ScatterSeriesOption, SeriesOption} from 'echarts';

import {t} from 'sentry/locale';
import {defined} from 'sentry/utils';
import type {DurationUnit, RateUnit, SizeUnit} from 'sentry/utils/discover/fields';
import {scaleTabularDataColumn} from 'sentry/utils/tabularData/scaleTabularDataColumn';
import {ECHARTS_MISSING_DATA_VALUE} from 'sentry/utils/timeSeries/timeSeriesItemToEChartsDataPoint';
import {getSampleChartSymbol} from 'sentry/views/insights/common/views/spanSummaryPage/sampleList/durationChart/getSampleChartSymbol';
import {crossIconPath} from 'sentry/views/insights/common/views/spanSummaryPage/sampleList/durationChart/symbol';

import {isAPlottableTimeSeriesValueType} from '../../common/typePredicates';
import type {
  TabularData,
  TabularRow,
  TabularValueUnit,
  TimeSeriesValueUnit,
} from '../../common/types';
import {FALLBACK_TYPE} from '../settings';

import {BaselineMarkLine} from './baselineMarkline';
import type {Plottable, PlottableTimeSeriesValueType} from './plottable';

const {error, warn} = Sentry.logger;

type ScatterPlotDatum = [timestamp: string, value: number, id: string];

type ValidSampleRow = {
  [key: string]: string | number | null;
  id: string;
  timestamp: string;
};

export type SamplesConfig = {
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
   * Callback for ECharts' `onHighlight`. Called with the sample that corresponds to the highlighted sample in the chart
   */
  onHighlight?: (datum: ValidSampleRow) => void;
};

export type SamplesPlottingOptions = {
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
  #timestamps: readonly string[];
  config: Readonly<SamplesConfig>;

  constructor(samples: TabularData, config: SamplesConfig) {
    this.sampleTableData = samples;
    this.#timestamps = samples.data
      .filter(isValidSampleRow)
      .map(sample => sample.timestamp)
      .toSorted();
    this.config = config;
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

  get start(): string | null {
    return this.#timestamps.at(0) ?? null;
  }

  get end(): string | null {
    return this.#timestamps.at(-1) ?? null;
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
        if (!defined(sample.timestamp)) {
          return false;
        }

        const ts = new Date(sample.timestamp);

        return (
          (!boundaryStart || ts >= boundaryStart) && (!boundaryEnd || ts <= boundaryEnd)
        );
      }),
    };
  }

  constrain(boundaryStart: Date | null, boundaryEnd: Date | null) {
    return new Samples(this.constrainSamples(boundaryStart, boundaryEnd), this.config);
  }

  onHighlight(dataIndex: number): void {
    const {config} = this;

    const sample = this.sampleTableData.data.at(dataIndex);

    if (!sample) {
      error('`Samples` plottable `onHighlight` out-of-range error', {
        dataIndex,
      });
      return;
    }

    if (!isValidSampleRow(sample)) {
      warn('`Samples` plottable `onHighlight` almost received an invalid row', {
        dataIndex,
      });
      return;
    }

    config.onHighlight?.(sample);
  }

  toSeries(plottingOptions: SamplesPlottingOptions): SeriesOption[] {
    const {sampleTableData: samples, config} = this;
    const {theme} = plottingOptions;

    const series: ScatterSeriesOption = {
      type: 'scatter',
      name: this.label,
      data: samples.data.filter(isValidSampleRow).map(sample => {
        const value = sample[config.attributeName];
        return [sample.timestamp, value ?? ECHARTS_MISSING_DATA_VALUE, sample.id];
      }),
      symbol: (value: ScatterPlotDatum) => {
        const {symbol} = config.baselineValue
          ? getSampleChartSymbol(value[1], config.baselineValue, theme)
          : {symbol: crossIconPath};

        return symbol;
      },
      markLine: config.baselineValue
        ? BaselineMarkLine({value: config.baselineValue, label: config.baselineLabel})
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
            : {color: theme.gray500};
          return color;
        },
      },
    };

    return [series];
  }
}

function isValidSampleRow(row: TabularRow): row is ValidSampleRow {
  if (typeof row.id === 'string' && typeof row.timestamp === 'string') {
    return true;
  }

  return false;
}
