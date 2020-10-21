import * as React from 'react';
import {Location} from 'history';
import {browserHistory} from 'react-router';
import {EChartOption} from 'echarts/lib/echarts';

import DataZoomInside from 'app/components/charts/components/dataZoomInside';
import ToolBox from 'app/components/charts/components/toolBox';
import {callIfFunction} from 'app/utils/callIfFunction';
import {EChartChartReadyHandler, EChartDataZoomHandler} from 'app/types/echarts';

export type RenderProps = {
  dataZoom: EChartOption['dataZoom'];
  toolBox: EChartOption['toolbox'];
  onChartReady: EChartChartReadyHandler;
  onDataZoom: EChartDataZoomHandler;
};

export type BarChartBucket = {
  start: number;
  end: number;
};

type Props = {
  location: Location;
  /**
   * This is the query parameter the start of the zoom will be propagated to.
   */
  paramStart: string;
  /**
   * This is the query parameter the end of the zoom will be propagated to.
   */
  paramEnd: string;
  /**
   * This is the minimum width of the zoom. If the targeted zoom area is
   * smaller than is specified by this parameter, the zoom will be cancelled
   * and the `onDataZoomCancelled` callback will be called.
   */
  minZoomWidth?: number;
  /**
   * This is the list of bucket start and end ranges. This is used by the
   * component to determine the start and end of the zoom.
   */
  buckets: BarChartBucket[];
  /**
   * If you need the dataZoom control to control more than one chart.
   * you can provide a list of the axis indexes.
   */
  xAxisIndex: number[];
  /**
   * The children function that will receive the render props and return
   * a rendered chart.
   */
  children: (props: RenderProps) => React.ReactNode;
  /**
   * This callback is called when the zoom action was cancelled. It can happen
   * when `minZoomWidth` is specified and the user tries to zoom on an area
   * smaller than that.
   */
  onDataZoomCancelled?: () => void;
  onChartReady?: EChartChartReadyHandler;
  onDataZoom?: EChartDataZoomHandler;
};

class BarChartZoom extends React.Component<Props> {
  /**
   * Enable zoom immediately instead of having to toggle to zoom
   */
  handleChartReady = chart => {
    chart.dispatchAction({
      type: 'takeGlobalCursor',
      key: 'dataZoomSelect',
      dataZoomSelectActive: true,
    });

    callIfFunction(this.props.onChartReady, chart);
  };

  handleDataZoom = (evt, chart) => {
    const model = chart.getModel();
    const {xAxis} = model.option;
    const axis = xAxis[0];

    // Both of these values should not be null, but we include it just in case.
    // These values are null when the user uses the toolbox included in ECharts
    // to navigate back through zoom history, but we hide it below.
    if (axis.rangeStart !== null && axis.rangeEnd !== null) {
      const {buckets, location, paramStart, paramEnd, minZoomWidth} = this.props;
      const {start} = buckets[axis.rangeStart];
      const {end} = buckets[axis.rangeEnd];

      if (minZoomWidth === undefined || end - start > minZoomWidth) {
        const target = {
          pathname: location.pathname,
          query: {
            ...location.query,
            [paramStart]: start,
            [paramEnd]: end,
          },
        };
        browserHistory.push(target);
      } else {
        // Dispatch the restore action here to stop ECharts from zooming
        chart.dispatchAction({type: 'restore'});
        callIfFunction(this.props.onDataZoomCancelled);
      }
    } else {
      // Dispatch the restore action here to stop ECharts from zooming
      chart.dispatchAction({type: 'restore'});
      callIfFunction(this.props.onDataZoomCancelled);
    }

    callIfFunction(this.props.onDataZoom, evt, chart);
  };

  render() {
    const {children, xAxisIndex} = this.props;

    const renderProps = {
      onChartReady: this.handleChartReady,
      dataZoom: DataZoomInside({xAxisIndex}),
      // We must include data zoom in the toolbox for the zoom to work,
      // but we do not want to show the toolbox components.
      toolBox: ToolBox(
        {},
        {
          dataZoom: {
            title: {
              zoom: '',
              back: '',
            },
            iconStyle: {
              borderWidth: 0,
              color: 'transparent',
              opacity: 0,
            },
          },
        }
      ),
      onDataZoom: this.handleDataZoom,
    };

    return children(renderProps);
  }
}

export default BarChartZoom;
