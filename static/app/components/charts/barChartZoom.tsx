import {Component} from 'react';
import {browserHistory} from 'react-router';
import {Location} from 'history';

import DataZoomInside from 'sentry/components/charts/components/dataZoomInside';
import ToolBox from 'sentry/components/charts/components/toolBox';
import {EChartChartReadyHandler, EChartDataZoomHandler} from 'sentry/types/echarts';

type RenderProps = {
  dataZoom: ReturnType<typeof DataZoomInside>;
  onChartReady: EChartChartReadyHandler;
  onDataZoom: EChartDataZoomHandler;
  toolBox: ReturnType<typeof ToolBox>;
};

export type BarChartBucket = {
  end: number;
  start: number;
};

type Props = {
  /**
   * This is the list of bucket start and end ranges. This is used by the
   * component to determine the start and end of the zoom.
   */
  buckets: BarChartBucket[];
  /**
   * The children function that will receive the render props and return
   * a rendered chart.
   */
  children: (props: RenderProps) => React.ReactNode;
  location: Location;
  /**
   * This is the query parameter the end of the zoom will be propagated to.
   */
  paramEnd: string;
  /**
   * This is the query parameter the start of the zoom will be propagated to.
   */
  paramStart: string;
  /**
   * If you need the dataZoom control to control more than one chart.
   * you can provide a list of the axis indexes.
   */
  xAxisIndex: number[];
  /**
   * This is the minimum width of the zoom. If the targeted zoom area is
   * smaller than is specified by this parameter, the zoom will be cancelled
   * and the `onDataZoomCancelled` callback will be called.
   */
  minZoomWidth?: number;
  onChartReady?: EChartChartReadyHandler;
  onDataZoom?: EChartDataZoomHandler;
  /**
   * This callback is called when the zoom action was cancelled. It can happen
   * when `minZoomWidth` is specified and the user tries to zoom on an area
   * smaller than that.
   */
  onDataZoomCancelled?: () => void;
  /**
   *
   */
  onHistoryPush?: (start: number, end: number) => void;
};

class BarChartZoom extends Component<Props> {
  zooming: (() => void) | null = null;

  /**
   * Enable zoom immediately instead of having to toggle to zoom
   */
  handleChartReady = chart => {
    this.props.onChartReady?.(chart);
  };

  /**
   * Chart event when *any* rendering+animation finishes
   *
   * `this.zooming` acts as a callback function so that
   * we can let the native zoom animation on the chart complete
   * before we update URL state and re-render
   */
  handleChartFinished = (_props, chart) => {
    if (typeof this.zooming === 'function') {
      this.zooming();
      this.zooming = null;
    }

    // This attempts to activate the area zoom toolbox feature
    const zoom = chart._componentsViews?.find(c => c._features && c._features.dataZoom);
    if (zoom && !zoom._features.dataZoom._isZoomActive) {
      // Calling dispatchAction will re-trigger handleChartFinished
      chart.dispatchAction({
        type: 'takeGlobalCursor',
        key: 'dataZoomSelect',
        dataZoomSelectActive: true,
      });
    }
  };

  handleDataZoom = (evt, chart) => {
    const model = chart.getModel();
    const {startValue, endValue} = model._payload.batch[0];

    // Both of these values should not be null, but we include it just in case.
    // These values are null when the user uses the toolbox included in ECharts
    // to navigate back through zoom history, but we hide it below.
    if (startValue !== null && endValue !== null) {
      const {buckets, location, paramStart, paramEnd, minZoomWidth, onHistoryPush} =
        this.props;
      const {start} = buckets[startValue];
      const {end} = buckets[endValue];

      if (minZoomWidth === undefined || end - start > minZoomWidth) {
        const target = {
          pathname: location.pathname,
          query: {
            ...location.query,
            [paramStart]: start,
            [paramEnd]: end,
          },
        };
        if (onHistoryPush) {
          onHistoryPush(start, end);
        } else {
          browserHistory.push(target);
        }
      } else {
        // Dispatch the restore action here to stop ECharts from zooming
        chart.dispatchAction({type: 'restore'});
        this.props.onDataZoomCancelled?.();
      }
    } else {
      // Dispatch the restore action here to stop ECharts from zooming
      chart.dispatchAction({type: 'restore'});
      this.props.onDataZoomCancelled?.();
    }

    this.props.onDataZoom?.(evt, chart);
  };

  render() {
    const {children, xAxisIndex} = this.props;

    const renderProps = {
      onChartReady: this.handleChartReady,
      onFinished: this.handleChartFinished,
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
