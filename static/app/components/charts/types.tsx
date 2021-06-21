import {EChartOption, EChartsLoadingOption} from 'echarts';
import * as React from 'react';

type Func = (...args: any[]) => any;

type EventMap = {
  [key: string]: Func,
}

type ObjectMap = {
  [key: string]: any,
}

type optsMap = {
  devicePixelRatio?: number,
  renderer?: 'canvas' | 'svg',
  width?: number | null | undefined | 'auto',
  height?: number | null | undefined | 'auto',
}

export type EchartsProps = {
  /**
   * the echarts option config
   * @see http://echarts.baidu.com/option.html#title
   */
  option: EChartOption;
  /**
   * when `setOption`, not merge the data.
   * @default false
   * @see http://echarts.baidu.com/api.html#echartsInstance.setOption
   */
  notMerge?: boolean;
  /**
   * when `setOption`, lazy update the data.
   * @default false
   * @see http://echarts.baidu.com/api.html#echartsInstance.setOption
   */
  lazyUpdate?: boolean;
  /**
   * the `style` of echarts div.
   * @default {height: '300px'}
   */
  style?: React.CSSProperties;
  /**
   * the `class` of echarts div. you can setting the css style of charts by class name.
   */
  className?: string;
  /**
   * the `theme` of echarts. should `registerTheme` before use it.
   * @see https://github.com/ecomfe/echarts/blob/master/theme/dark.js)
   * @example
   * ```
   // register theme object
   echarts.registerTheme('my_theme', { backgroundColor: '#f4cccc' });
   // render the echarts use option `theme`
   <ReactEcharts option={this.getOption()} theme='my_theme' />
   * ```
   */
  theme?: string | null | ObjectMap;
  /**
   * when the chart is ready, will callback the function with the `echarts object` as it's paramter.
   */
  onChartReady?: Func;
  /**
   * when the chart is rendering, show the loading mask.
   */
  showLoading?: boolean;
  /**
   * the echarts loading option config.
   * @see http://echarts.baidu.com/api.html#echartsInstance.showLoading
   */
  loadingOption?: EChartsLoadingOption;
  /**
   * binding the echarts event, will callback with the `echarts event object`, and the `echart object` as it's paramters.
   * @example
   * ```
   let onEvents = {
        'click': this.onChartClick,
        'legendselectchanged': this.onChartLegendselectchanged
      }
   <ReactEcharts onEvents={onEvents} />
   * ```
   * @see: http://echarts.baidu.com/api.html#events
   */
  onEvents?: EventMap;
  /**
   * the `opts` of echarts. will be used when initial echarts instance by `echarts.init`.
   * @see http://echarts.baidu.com/api.html#echarts.init
   */
  opts?: optsMap;
  shouldSetOption?: Func;

  echarts: object;
}
