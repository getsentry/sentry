import {useCallback, useMemo, useState} from 'react';
import type {
  DataZoomComponentOption,
  InsideDataZoomComponentOption,
  ToolboxComponentOption,
  XAXisComponentOption,
} from 'echarts';
import moment from 'moment-timezone';
import * as qs from 'query-string';

import {updateDateTime} from 'sentry/actionCreators/pageFilters';
import DataZoomInside from 'sentry/components/charts/components/dataZoomInside';
import DataZoomSlider from 'sentry/components/charts/components/dataZoomSlider';
import ToolBox from 'sentry/components/charts/components/toolBox';
import type {DateString} from 'sentry/types/core';
import type {
  EChartChartReadyHandler,
  EChartDataZoomHandler,
  EChartFinishedHandler,
  EChartRestoreHandler,
} from 'sentry/types/echarts';
import type {InjectedRouter} from 'sentry/types/legacyReactRouter';
import {getUtcDateString, getUtcToLocalDateObject} from 'sentry/utils/dates';

// TODO: replace usages of ChartZoom with useChartZoom

const getDate = date =>
  date ? moment.utc(date).format(moment.HTML5_FMT.DATETIME_LOCAL_SECONDS) : null;

type Period = {
  end: DateString;
  period: string | null;
  start: DateString;
};

const ZoomPropKeys = [
  'period',
  'xAxis',
  'onChartReady',
  'onDataZoom',
  'onRestore',
  'onFinished',
] as const;

export interface ZoomRenderProps extends Pick<Props, (typeof ZoomPropKeys)[number]> {
  dataZoom?: DataZoomComponentOption[];
  end?: Date;
  isGroupedByDate?: boolean;
  showTimeInTooltip?: boolean;
  start?: Date;
  toolBox?: ToolboxComponentOption;
  utc?: boolean;
}

interface Props {
  children: (props: ZoomRenderProps) => React.ReactNode;
  chartZoomOptions?: DataZoomComponentOption;
  disabled?: boolean;
  end?: DateString;
  onChartReady?: EChartChartReadyHandler;
  onDataZoom?: EChartDataZoomHandler;
  onFinished?: EChartFinishedHandler;
  onRestore?: EChartRestoreHandler;
  onZoom?: (period: Period) => void;
  period?: string | null;
  router?: InjectedRouter;
  saveOnZoom?: boolean;
  showSlider?: boolean;
  start?: DateString;
  usePageDate?: boolean;
  utc?: boolean | null;
  xAxis?: XAXisComponentOption;
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
  utc,
  router,
  onZoom,
  usePageDate,
  saveOnZoom,
  onChartReady,
  onRestore,
  onDataZoom,
  onFinished,
  xAxisIndex,
  showSlider,
  chartZoomOptions,
  xAxis,
  disabled,
}: Omit<Props, 'children'> = {}) {
  const [currentPeriod, setCurrentPeriod] = useState<Period | undefined>({
    period: period!,
    start: getDate(start),
    end: getDate(end),
  });
  const [history, setHistory] = useState<Period[]>([]);

  const [zooming, setZooming] = useState<(() => void) | null>(null);

  /**
   * Save current period state from period in props to be used
   * in handling chart's zoom history state
   */
  const saveCurrentPeriod = useCallback(
    (newPeriod: Period) => {
      if (disabled) {
        return;
      }

      setCurrentPeriod({
        period: newPeriod.period,
        start: getDate(newPeriod.start),
        end: getDate(newPeriod.end),
      });
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
    (newPeriod, saveHistory = false) => {
      const startFormatted = getDate(newPeriod.start);
      const endFormatted = getDate(newPeriod.end);

      // Save period so that we can revert back to it when using echarts "back" navigation
      if (saveHistory) {
        setHistory(curr => [...curr, currentPeriod!]);
      }

      // Callback to let parent component know zoom has changed
      // This is required for some more perceived responsiveness since
      // we delay updating URL state so that chart animation can finish
      //
      // Parent container can use this to change into a loading state before
      // URL parameters are changed
      onZoom?.({
        period: newPeriod.period,
        start: startFormatted,
        end: endFormatted,
      });

      setZooming(() => {
        if (usePageDate && router) {
          const newQuery = {
            ...router.location.query,
            pageStart: newPeriod.start ? getUtcDateString(newPeriod.start) : undefined,
            pageEnd: newPeriod.end ? getUtcDateString(newPeriod.end) : undefined,
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
              start: startFormatted
                ? getUtcToLocalDateObject(startFormatted)
                : startFormatted,
              end: endFormatted ? getUtcToLocalDateObject(endFormatted) : endFormatted,
            },
            router,
            {save: saveOnZoom}
          );
        }

        saveCurrentPeriod(newPeriod);
      });
    },
    [currentPeriod, onZoom, router, saveCurrentPeriod, saveOnZoom, usePageDate]
  );

  /**
   * Enable zoom immediately instead of having to toggle to zoom
   */
  const handleChartReady = chart => {
    onChartReady?.(chart);
  };

  /**
   * Restores the chart to initial viewport/zoom level
   *
   * Updates URL state to reflect initial params
   */
  const handleZoomRestore = (evt, chart) => {
    if (!history.length) {
      return;
    }

    setPeriod(history[0]);
    setHistory([]);

    onRestore?.(evt, chart);
  };

  const handleDataZoom = (evt, chart) => {
    const model = chart.getModel();
    const {startValue, endValue} = model._payload.batch[0];

    // if `rangeStart` and `rangeEnd` are null, then we are going back
    if (startValue === null && endValue === null) {
      const previousPeriod = history.pop();
      setHistory(history);

      if (!previousPeriod) {
        return;
      }

      setPeriod(previousPeriod);
    } else {
      setPeriod(
        // Add a day so we go until the end of the day (e.g. next day at midnight)
        {period: null, start: moment.utc(startValue), end: moment.utc(endValue)},
        true
      );
    }

    onDataZoom?.(evt, chart);
  };

  /**
   * Chart event when *any* rendering+animation finishes
   *
   * `this.zooming` acts as a callback function so that
   * we can let the native zoom animation on the chart complete
   * before we update URL state and re-render
   */
  const handleChartFinished = (_props, chart) => {
    if (typeof zooming === 'function') {
      zooming();
      setZooming(null);
    }

    // This attempts to activate the area zoom toolbox feature
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
  };

  const startProp = start ? getUtcToLocalDateObject(start) : undefined;
  const endProp = end ? getUtcToLocalDateObject(end) : undefined;

  const dataZoomProp = useMemo(() => {
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

  const toolBox = useMemo(
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

  const renderProps = {
    // Zooming only works when grouped by date
    isGroupedByDate: true,
    utc: utc ?? undefined,
    start: startProp,
    end: endProp,
    xAxis,
    dataZoom: dataZoomProp,
    showTimeInTooltip: true,
    toolBox,
    onChartReady: handleChartReady,
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
