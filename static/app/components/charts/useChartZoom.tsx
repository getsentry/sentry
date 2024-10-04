import {useCallback, useMemo, useRef} from 'react';
import type {
  DataZoomComponentOption,
  InsideDataZoomComponentOption,
  ToolboxComponentOption,
} from 'echarts';
import * as qs from 'query-string';

import {updateDateTime} from 'sentry/actionCreators/pageFilters';
import DataZoomInside from 'sentry/components/charts/components/dataZoomInside';
import DataZoomSlider from 'sentry/components/charts/components/dataZoomSlider';
import ToolBox from 'sentry/components/charts/components/toolBox';
import type {DateString} from 'sentry/types/core';
import type {
  EChartDataZoomHandler,
  EChartFinishedHandler,
  EChartRestoreHandler,
} from 'sentry/types/echarts';
import type {InjectedRouter} from 'sentry/types/legacyReactRouter';
import {getUtcDateString} from 'sentry/utils/dates';

// TODO: replace usages of ChartZoom with useChartZoom

type DateTimeUpdate = Parameters<typeof updateDateTime>[0];

/**
 * Our api expects a specific date format
 */
const getQueryTime = (date: DateString | undefined) =>
  date ? getUtcDateString(date) : null;

interface ZoomRenderProps {
  dataZoom: DataZoomComponentOption[];
  end: Date | undefined;
  isGroupedByDate: boolean;
  onDataZoom: EChartDataZoomHandler;
  onFinished: EChartFinishedHandler;
  onRestore: EChartRestoreHandler;
  start: Date | undefined;
  toolBox: ToolboxComponentOption;
}

interface Props {
  children: (props: ZoomRenderProps) => React.ReactNode;
  chartZoomOptions?: DataZoomComponentOption;
  /**
   * Disables saving changes to the current period
   */
  disabled?: boolean;
  end?: DateString;
  onDataZoom?: EChartDataZoomHandler;
  onFinished?: EChartFinishedHandler;
  onRestore?: EChartRestoreHandler;
  onZoom?: (period: DateTimeUpdate) => void;
  period?: string | null;
  router?: InjectedRouter;
  /**
   * Persist changes to the page filter selection into local storage
   * Must provide router to apply changes
   */
  saveOnZoom?: boolean;
  showSlider?: boolean;
  start?: DateString;
  usePageDate?: boolean;
  xAxisIndex?: number | number[];
}

/**
 * This hook provides an alternative to using the `ChartZoom` component. It returns
 * the props that would be passed to the `BaseChart` as zoomRenderProps.
 */
export function useChartZoom({
  period,
  start,
  end,
  router,
  onZoom,
  onDataZoom,
  onFinished,
  onRestore,
  usePageDate,
  saveOnZoom,
  xAxisIndex,
  showSlider,
  chartZoomOptions,
  disabled,
}: Omit<Props, 'children'>): ZoomRenderProps {
  const currentPeriod = useRef<DateTimeUpdate | undefined>({
    period: period!,
    start: getQueryTime(start),
    end: getQueryTime(end),
  });
  const history = useRef<DateTimeUpdate[]>([]);
  /**
   * Used to store the date update function so that we can call it after the chart
   * animation is complete
   */
  const zooming = useRef<(() => void) | null>(null);

  /**
   * Save current period state from period in props to be used
   * in handling chart's zoom history state
   */
  const saveCurrentPeriod = useCallback(
    (newPeriod: DateTimeUpdate) => {
      if (disabled) {
        return;
      }

      currentPeriod.current = {
        period: newPeriod.period,
        start: getQueryTime(newPeriod.start),
        end: getQueryTime(newPeriod.end),
      };
    },
    [disabled]
  );

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
    (newPeriod: DateTimeUpdate, saveHistory = false) => {
      const startFormatted = getQueryTime(newPeriod.start);
      const endFormatted = getQueryTime(newPeriod.end);

      // Save period so that we can revert back to it when using echarts "back" navigation
      if (saveHistory) {
        history.current = [...history.current, currentPeriod.current!];
      }

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
        if (usePageDate && router) {
          const newQuery = {
            ...router.location.query,
            pageStart: startFormatted,
            pageEnd: endFormatted,
            pageStatsPeriod: newPeriod.period ?? undefined,
          };

          // Only push new location if query params has changed because this will cause a heavy re-render
          if (qs.stringify(newQuery) !== qs.stringify(router.location.query)) {
            router.push({
              pathname: router.location.pathname,
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

        saveCurrentPeriod(newPeriod);
      };
    },
    [onZoom, router, saveCurrentPeriod, saveOnZoom, usePageDate]
  );

  /**
   * Restores the chart to initial viewport/zoom level
   *
   * Updates URL state to reflect initial params
   */
  const handleZoomRestore = useCallback<EChartRestoreHandler>(
    (evt, chart) => {
      if (!history.current.length) {
        return;
      }

      setPeriod(history.current[0]);
      history.current = [];

      onRestore?.(evt, chart);
    },
    [onRestore, setPeriod]
  );

  const handleDataZoom = useCallback<EChartDataZoomHandler>(
    (evt, chart) => {
      // @ts-expect-error getModel is private
      const model = chart.getModel();
      const {startValue, endValue} = model._payload.batch[0] as {
        endValue: number | null;
        startValue: number | null;
      };

      // if `rangeStart` and `rangeEnd` are null, then we are going back
      if (startValue === null && endValue === null) {
        const previousPeriod = history.current.pop();

        if (!previousPeriod) {
          return;
        }

        setPeriod(previousPeriod);
      } else {
        setPeriod(
          // Add a day so we go until the end of the day (e.g. next day at midnight)
          {
            period: null,
            start: startValue ? getUtcDateString(startValue) : null,
            end: endValue ? getUtcDateString(endValue) : null,
          },
          true
        );
      }

      onDataZoom?.(evt, chart);
    },
    [onDataZoom, setPeriod]
  );

  /**
   * Chart event when *any* rendering+animation finishes
   *
   * `this.zooming` acts as a callback function so that
   * we can let the native zoom animation on the chart complete
   * before we update URL state and re-render
   */
  const handleChartFinished = useCallback<EChartFinishedHandler>(
    (_props, chart) => {
      if (typeof zooming.current === 'function') {
        zooming.current();
        zooming.current = null;
      }

      // This attempts to activate the area zoom toolbox feature
      // @ts-expect-error _componentsViews is private
      const zoom = chart._componentsViews?.find(c => c._features?.dataZoom);
      if (zoom && !zoom._features.dataZoom._isZoomActive) {
        // Calling dispatchAction will re-trigger handleChartFinished
        chart.dispatchAction({
          type: 'takeGlobalCursor',
          key: 'dataZoomSelect',
          dataZoomSelectActive: true,
        });
      }

      if (typeof onFinished === 'function') {
        onFinished(_props, chart);
      }
    },
    [onFinished]
  );

  const startProp = start ? new Date(start) : undefined;
  const endProp = end ? new Date(end) : undefined;

  const dataZoomProp = useMemo<DataZoomComponentOption[]>(() => {
    return showSlider
      ? [
          ...DataZoomSlider({xAxisIndex, ...chartZoomOptions}),
          ...DataZoomInside({
            xAxisIndex,
            ...(chartZoomOptions as InsideDataZoomComponentOption),
          }),
        ]
      : DataZoomInside({
          xAxisIndex,
          ...(chartZoomOptions as InsideDataZoomComponentOption),
        });
  }, [chartZoomOptions, showSlider, xAxisIndex]);

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
    start: startProp,
    end: endProp,
    dataZoom: dataZoomProp,
    toolBox,
    onDataZoom: handleDataZoom,
    onFinished: handleChartFinished,
    onRestore: handleZoomRestore,
  };

  return renderProps;
}

function ChartZoom(props: Props) {
  const renderProps = useChartZoom(props);

  return props.children(renderProps);
}

export default ChartZoom;
