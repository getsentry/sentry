import * as React from 'react';
import echarts from 'echarts';
import {EChartOption} from 'echarts/lib/echarts';
import {EChartChartReadyHandler} from 'app/types/echarts';

import {EchartsProps} from './types';

type Props = {
  notMerge: boolean;
  lazyUpdate: boolean;
  theme?: EchartsProps['theme'];
  onChartReady: EChartChartReadyHandler;
  onEvents?: EchartsProps['onEvents'];
  style?: React.CSSProperties;
  opts: {height: any, width: any, renderer: any, devicePixelRatio: any};
  option?: EChartOption;
}

export default class ChartCore extends React.Component<Props> {
  echarts = echarts;
  ele: HTMLDivElement | null = null;

  getEchartsInstance() {
    if(!this.ele) {
      return;
    }
    const {
      notMerge,
      lazyUpdate,
      theme,
      onChartReady,
      onEvents,
      style,
      opts,
      option
    } = this.props;

    const chart = this.echarts.init(this.ele);
    chart.setOption({
      ...option,
      notMerge,
      lazyUpdate,
      theme,
      onChartReady,
      onEvents,
      style,
      opts,
    });
  }

  componentDidMount(){
    this.getEchartsInstance()
  }

  componentDidUpdate(){
    this.getEchartsInstance();
  }

  render() {
    return (
      <div
        ref={(e: HTMLDivElement | null) => {
          this.ele = e;
        }}
        style={{ height: 300 }}
      >
      </div>
    );
  }
};