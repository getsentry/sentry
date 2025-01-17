import {useCallback, useEffect, useMemo, useRef} from 'react';
import type {DataZoomComponentOption, ECharts, ToolboxComponentOption} from 'echarts';
import * as qs from 'query-string';

import {updateDateTime} from 'sentry/actionCreators/pageFilters';
import DataZoomInside from 'sentry/components/charts/components/dataZoomInside';
import ToolBox from 'sentry/components/charts/components/toolBox';
import type {DateString} from 'sentry/types/core';
import type {
  EChartChartReadyHandler,
  EChartDataZoomHandler,
  EChartFinishedHandler,
} from 'sentry/types/echarts';
import {getUtcDateString} from 'sentry/utils/dates';
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';
import useRouter from 'sentry/utils/useRouter';

// TODO: replace usages of ChartZoom with useChartZoom

type DateTimeUpdate = Parameters<typeof updateDateTime>[0];

/**
 * Our api query params expects a specific date format
 */
const getQueryTime = (date: DateString | undefined) =>
  date ? getUtcDateString(date) : null;

interface ZoomRenderProps {
  dataZoom: DataZoomComponentOption[];
  isGroupedByDate: boolean;
  onChartReady: EChartChartReadyHandler;
  onDataZoom: EChartDataZoomHandler;
  onFinished: EChartFinishedHandler;
  toolBox: ToolboxComponentOption;
}

interface Props {
  children: (props: ZoomRenderProps) => React.ReactNode;
  /**
   * Disables saving changes to the current period
   */
  disabled?: boolean;
  onZoom?: (period: DateTimeUpdate) => void;
  /**
   * Use either `saveOnZoom` or `usePageDate` not both
   * Will persist zoom state to page filters
   */
  saveOnZoom?: boolean;
  /**
   * Use either `saveOnZoom` or `usePageDate` not both
   * Persists zoom state to query params without updating page filters.
   * Sets the pageStart and pageEnd query params
   */
  usePageDate?: boolean;
  xAxisIndex?: number | number[];
}

/**
 * Adds listeners to the document to allow for cancelling the zoom action
 */
function useChartZoomCancel() {
  const chartInstance = useRef<ECharts | null>(null);
  const handleKeyDown = useCallback((evt: KeyboardEvent) => {
    if (!chartInstance.current) {
      return;
    }

    if (evt.key === 'Escape') {
      evt.stopPropagation();
      // Mark the component as currently cancelling a zoom selection. This allows
      // us to prevent "restore" handlers from running
      // "restore" removes the current chart zoom selection
      chartInstance.current.dispatchAction({
        type: 'restore',
      });
    }
  }, []);

  const handleMouseUp = useCallback(() => {
    document.body.removeEventListener('mouseup', handleMouseUp);
  }, []);

  const handleMouseDown = useCallback(() => {
    // Register `mouseup` and `keydown` listeners on mouse down
    // This ensures that there is only one live listener at a time
    // regardless of how many charts are rendered. NOTE: It's
    // important to set `useCapture: true` in the `"keydown"` handler
    // otherwise the Escape will close whatever modal or panel the
    // chart is in. Those elements register their handlers _earlier_.
    document.body.addEventListener('mouseup', handleMouseUp);
    document.body.addEventListener('keydown', handleKeyDown, true);
  }, [handleKeyDown, handleMouseUp]);

  const handleChartReady = useCallback<EChartChartReadyHandler>(
    chart => {
      if (chartInstance.current) {
        // remove listeners from previous chart if called multiple times
        chartInstance.current.getDom()?.removeEventListener('mousedown', handleMouseDown);
      }

      chartInstance.current = chart;
      const chartDom = chart.getDom();
      chartDom.addEventListener('mousedown', handleMouseDown);
    },
    [handleMouseDown]
  );

  useEffect(() => {
    return () => {
      // Cleanup listeners on unmount
      document.body.removeEventListener('mouseup', handleMouseUp);
      document.body.removeEventListener('keydown', handleKeyDown);
      chartInstance.current?.getDom()?.removeEventListener('mousedown', handleMouseDown);
    };
  }, [handleMouseDown, handleMouseUp, handleKeyDown]);

  return {handleChartReady};
}

/**
 * This hook provides an alternative to using the `ChartZoom` component. It returns
 * the props that would be passed to the `BaseChart` as zoomRenderProps.
 */
export function useChartZoom({
  onZoom,
  usePageDate,
  saveOnZoom,
  xAxisIndex,
}: Omit<Props, 'children'>): ZoomRenderProps {
  const {handleChartReady} = useChartZoomCancel();
  const location = useLocation();
  const navigate = useNavigate();
  const router = useRouter();

  /**
   * Used to store the date update function so that we can call it after the chart
   * animation is complete
   */
  const zooming = useRef<(() => void) | null>(null);

  /**
   * Sets the new period due to a zoom related action
   *
   * Saves the current period to an instance property so that we
   * can control URL state when zoom history is being manipulated
   * by the chart controls.
   *
   * Saves a callback function to be called after chart animation is completed
   */
  const setPeriod = useCallback(
    (newPeriod: DateTimeUpdate) => {
      const startFormatted = getQueryTime(newPeriod.start);
      const endFormatted = getQueryTime(newPeriod.end);

      // Callback to let parent component know zoom has changed
      // This is required for some more perceived responsiveness since
      // we delay updating URL state so that chart animation can finish
      //
      // Parent container can use this to change into a loading state before
      // URL parameters are changed
      onZoom?.({
        period: newPeriod.period,
        start: getQueryTime(newPeriod.start),
        end: getQueryTime(newPeriod.end),
      });

      zooming.current = () => {
        if (usePageDate) {
          const newQuery = {
            ...location.query,
            pageStart: startFormatted,
            pageEnd: endFormatted,
            pageStatsPeriod: newPeriod.period ?? undefined,
          };

          // Only push new location if query params has changed because this will cause a heavy re-render
          if (qs.stringify(newQuery) !== qs.stringify(location.query)) {
            navigate({
              pathname: location.pathname,
              query: newQuery,
            });
          }
        } else {
          updateDateTime(
            {
              period: newPeriod.period,
              start: startFormatted,
              end: endFormatted,
            },
            router,
            {save: saveOnZoom}
          );
        }
      };
    },
    [onZoom, navigate, location, router, saveOnZoom, usePageDate]
  );

  const handleDataZoom = useCallback<EChartDataZoomHandler>(
    evt => {
      const {startValue, endValue} = (evt as any).batch[0] as {
        endValue: number | null;
        startValue: number | null;
      };

      // if `rangeStart` and `rangeEnd` are null, then we are going back
      if (startValue && endValue) {
        setPeriod({
          period: null,
          start: startValue ? getUtcDateString(startValue) : null,
          end: endValue ? getUtcDateString(endValue) : null,
        });
      }
    },
    [setPeriod]
  );

  /**
   * Chart event when *any* rendering+animation finishes
   *
   * `this.zooming` acts as a callback function so that
   * we can let the native zoom animation on the chart complete
   * before we update URL state and re-render
   */
  const handleChartFinished = useCallback<EChartFinishedHandler>((_props, chart) => {
    if (typeof zooming.current === 'function') {
      zooming.current();
      zooming.current = null;
    }

    // This attempts to activate the area zoom toolbox feature
    const zoom = (chart as any)._componentsViews?.find((c: any) => c._features?.dataZoom);
    if (zoom && !zoom._features.dataZoom._isZoomActive) {
      // Calling dispatchAction will re-trigger handleChartFinished
      chart.dispatchAction({
        type: 'takeGlobalCursor',
        key: 'dataZoomSelect',
        dataZoomSelectActive: true,
      });
    }
  }, []);

  const dataZoomProp = useMemo<DataZoomComponentOption[]>(() => {
    const zoomInside = DataZoomInside({
      xAxisIndex,
    });
    return zoomInside;
  }, [xAxisIndex]);

  const toolBox = useMemo<ToolboxComponentOption>(
    () =>
      ToolBox(
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
    []
  );

  const renderProps: ZoomRenderProps = {
    // Zooming only works when grouped by date
    isGroupedByDate: true,
    dataZoom: dataZoomProp,
    toolBox,
    onDataZoom: handleDataZoom,
    onFinished: handleChartFinished,
    onChartReady: handleChartReady,
  };

  return renderProps;
}

function ChartZoom(props: Props) {
  const renderProps = useChartZoom(props);

  return props.children(renderProps);
}

export default ChartZoom;
