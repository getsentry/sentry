import type {
  AxisPointerComponentOption,
  Color,
  ECharts as EChartsType,
  LineSeriesOption,
  PatternObject,
} from 'echarts';
import type EChartsReact from 'echarts-for-react';

import type {Confidence} from 'sentry/types/organization';

export type SeriesDataUnit = {
  // number because we sometimes use timestamps
  name: string | number;
  value: number;
  itemStyle?: {
    color?: string;
  };
  onClick?: (series: Series, instance: ECharts) => void;
};

export type Series = {
  data: SeriesDataUnit[];
  seriesName: string;
  areaStyle?: {
    color: string | PatternObject;
    opacity: number;
  };
  color?: string;
  confidence?: Confidence;
  id?: string;
  lineStyle?: AxisPointerComponentOption['lineStyle'];
  // https://echarts.apache.org/en/option.html#series-line.z
  markLine?: LineSeriesOption['markLine'];
  stack?: string;
  // https://echarts.apache.org/en/option.html#series-line.stack
  symbol?: LineSeriesOption['symbol'];
  symbolSize?: LineSeriesOption['symbolSize'];
  z?: number;
};

export type ReactEchartsRef = EChartsReact;

export type EChartEventHandler<P> = (params: P, instance: ECharts) => void;

export type EChartChartReadyHandler = (instance: ECharts) => void;

/**
 * Incomplete type for the "highlight" event handler in ECharts. This is taken
 * from a combination of the ECharts documentation page, and data seen in running code
 * in handlers attached to line charts and pie charts.
 */
interface EChartsHighlightEventParam {
  type: 'highlight';
  batch?: Array<{
    dataIndex: number;
    dataIndexInside: number;
    escapeConnect: boolean;
    notBlur: boolean;
    seriesIndex: number;
    type: string;
  }>;
  name?: string;
}

export type EChartHighlightHandler = EChartEventHandler<EChartsHighlightEventParam>;

export type EChartDownplayHandler = EChartEventHandler<EChartsHighlightEventParam>;

/**
 * Incomplete type for the "legendselectchanged" event handler in ECharts. This is extracted from types we were using in the app at one time.
 */
interface EChartsLegendSelectChangeEventParam {
  name: string;
  selected: Record<string, boolean>;
  type: 'legendselectchanged';
}

export type EChartLegendSelectChangeHandler =
  EChartEventHandler<EChartsLegendSelectChangeEventParam>;

type EChartMouseEventData = string | number | Record<string, any>;
/**
 * XXX: These are incomplete types and can also vary depending on the component type
 *
 * Taken from https://echarts.apache.org/en/api.html#events.Mouse%20events
 */
interface EChartMouseEventParam<T = EChartMouseEventData> {
  // subtype of the component to which the clicked glyph belongs
  // i.e. 'scatter', 'line', etc
  componentSubType: string;
  // type of the component to which the clicked glyph belongs
  // i.e., 'series', 'markLine', 'markPoint', 'timeLine'
  componentType: string;
  // incoming raw data item
  data: T;
  // data index in incoming data array
  dataIndex: number;
  // data name, category name
  name: string;
  // incoming data value
  value: number | number[];
  // color of component (make sense when componentType is 'series')
  color?: Color;

  // Some series, such as sankey or graph, maintains more than
  // one types of data (nodeData and edgeData), which can be
  // distinguished from each other by dataType with its value
  // 'node' and 'edge'.
  // On the other hand, most series has only one type of data,
  // where dataType is not needed.
  dataType?: string;
  seriesId?: string;
  // series index in incoming option.series (make sense when componentType is 'series')
  seriesIndex?: number;
  // series name (make sense when componentType is 'series')
  seriesName?: string;
  // series type (make sense when componentType is 'series')
  // i.e., 'line', 'bar', 'pie'
  seriesType?: string;
}

export type EChartMouseOutHandler<T = EChartMouseEventData> = EChartEventHandler<
  EChartMouseEventParam<T>
>;

export type EChartMouseOverHandler<T = EChartMouseEventData> = EChartEventHandler<
  EChartMouseEventParam<T>
>;

export type EChartClickHandler<T = EChartMouseEventData> = EChartEventHandler<
  EChartMouseEventParam<T>
>;

export type EChartDataZoomHandler = EChartEventHandler<{
  /**
   * percentage of zoom finish position, 0 - 100
   */
  end: number;
  /**
   * percentage of zoom start position, 0 - 100
   */
  start: number;
  type: 'datazoom';
  /**
   * data value of zoom finish position; only exists in zoom event of
   * triggered by toolbar
   */
  endValue?: number;
  /**
   * data value of zoom start position; only exists in zoom event of
   * triggered by toolbar
   */
  startValue?: number;
}>;

export type DataPoint = Pick<SeriesDataUnit, 'name' | 'value'>;

export type EChartRestoreHandler = EChartEventHandler<{type: 'restore'}>;

export type EChartFinishedHandler = EChartEventHandler<Record<string, unknown>>;

export type EChartRenderedHandler = EChartEventHandler<Record<string, unknown>>;

type EchartBrushAreas = Array<{
  coordRange: number[] | number[][];
  panelId: string;
  range: number[] | number[][];
}>;

export type EChartBrushStartHandler = EChartEventHandler<{
  areas: EchartBrushAreas;
  brushId: string;
  type: 'brush';
}>;

export type EChartBrushEndHandler = EChartEventHandler<{
  areas: EchartBrushAreas;
  brushId: string;
  type: 'brushend';
}>;

export type EChartBrushSelectedHandler = EChartEventHandler<{
  brushId: string;
  type: 'brushselected';
}>;

export type ECharts = EChartsType;
