import type {Location} from 'history';

import {DataZoomInside} from 'sentry/components/charts/components/dataZoomInside';
import {ToolBox} from 'sentry/components/charts/components/toolBox';
import type {
  EChartChartReadyHandler,
  EChartDataZoomHandler,
  EChartFinishedHandler,
  ECharts,
} from 'sentry/types/echarts';
import {useNavigate} from 'sentry/utils/useNavigate';

type RenderProps = {
  dataZoom: ReturnType<typeof DataZoomInside>;
  onChartReady: EChartChartReadyHandler;
  onDataZoom: EChartDataZoomHandler;
  onFinished: EChartFinishedHandler;
  toolBox: ReturnType<typeof ToolBox>;
};

type BarChartBucket = {
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

export function BarChartZoom({
  buckets,
  children,
  location,
  minZoomWidth,
  onChartReady,
  onDataZoom,
  onDataZoomCancelled,
  onHistoryPush,
  paramEnd,
  paramStart,
  xAxisIndex,
}: Props) {
  const navigate = useNavigate();

  /**
   * Enable zoom immediately instead of having to toggle to zoom
   */
  const handleChartReady = (chart: ECharts) => {
    onChartReady?.(chart);
  };

  /**
   * Chart event when *any* rendering+animation finishes
   */
  const handleChartFinished = (_props: any, chart: any) => {
    // This attempts to activate the area zoom toolbox feature
    const zoom = chart._componentsViews?.find((c: any) => c._features?.dataZoom);
    if (zoom && !zoom._features.dataZoom._isZoomActive) {
      // Calling dispatchAction will re-trigger handleChartFinished
      chart.dispatchAction({
        type: 'takeGlobalCursor',
        key: 'dataZoomSelect',
        dataZoomSelectActive: true,
      });
    }
  };

  const handleDataZoom = (evt: any, chart: any) => {
    const model = chart.getModel();
    const {startValue, endValue} = model._payload.batch[0];

    // Both of these values should not be null, but we include it just in case.
    // These values are null when the user uses the toolbox included in ECharts
    // to navigate back through zoom history, but we hide it below.
    if (startValue !== null && endValue !== null) {
      const {start} = buckets[startValue]!;
      const {end} = buckets[endValue]!;

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
          navigate(target);
        }
      } else {
        // Dispatch the restore action here to stop ECharts from zooming
        chart.dispatchAction({type: 'restore'});
        onDataZoomCancelled?.();
      }
    } else {
      // Dispatch the restore action here to stop ECharts from zooming
      chart.dispatchAction({type: 'restore'});
      onDataZoomCancelled?.();
    }

    onDataZoom?.(evt, chart);
  };

  return children({
    onChartReady: handleChartReady,
    onFinished: handleChartFinished,
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
    onDataZoom: handleDataZoom,
  });
}
