import {useCallback, useEffect, useMemo, useRef} from 'react';
import type {DataZoomComponentOption, ECharts, ToolboxComponentOption} from 'echarts';

import {CHART_ZOOM_MERGE_OPTIONS} from 'sentry/components/charts/chartZoomConfig';
import {DataZoomInside} from 'sentry/components/charts/components/dataZoomInside';
import {ToolBox} from 'sentry/components/charts/components/toolBox';
import {activateZoomAreaSelect} from 'sentry/components/charts/utils';
import {updateDateTime} from 'sentry/components/pageFilters/actions';
import type {DateString} from 'sentry/types/core';
import type {
  EChartChartReadyHandler,
  EChartDataZoomHandler,
  EChartFinishedHandler,
} from 'sentry/types/echarts';
import {getUtcDateString} from 'sentry/utils/dates';
import {navigateIfQueryChanged} from 'sentry/utils/navigateIfQueryChanged';
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';

// TODO: replace usages of ChartZoom with useChartZoom

type DateTimeUpdate = Parameters<typeof updateDateTime>[0];

type DataZoomRange = {
  endValue: number;
  startValue: number;
};

type DataZoomRangePayload = {
  endValue?: number | null;
  startValue?: number | null;
};

type DataZoomPayload = {
  batch?: DataZoomRangePayload[];
} & DataZoomRangePayload;

/**
 * Our api query params expects a specific date format
 */
const getQueryTime = (date: DateString | undefined) =>
  date ? getUtcDateString(date) : null;

function getFormattedPeriod({period, start, end}: DateTimeUpdate) {
  return {
    period,
    start: getQueryTime(start),
    end: getQueryTime(end),
  };
}

type FormattedPeriod = ReturnType<typeof getFormattedPeriod>;

function hasZoomValues(payload: DataZoomRangePayload): payload is DataZoomRange {
  return (
    payload.startValue !== null &&
    payload.startValue !== undefined &&
    payload.endValue !== null &&
    payload.endValue !== undefined
  );
}

function getZoomRange(evt: Parameters<EChartDataZoomHandler>[0]): DataZoomRange | null {
  const payload = evt as DataZoomPayload;
  // Toolbox brush selections report their selected x-axis range in the first
  // batch item. Some restore/back actions report nullish values instead.
  const zoomEvent = payload.batch?.[0] ?? payload;

  return hasZoomValues(zoomEvent) ? zoomEvent : null;
}

function roundZoomRange({startValue, endValue}: DataZoomRange): DataZoomRange {
  const roundedEndValue = Math.ceil(endValue / 60_000) * 60_000;
  let roundedStartValue = Math.floor(startValue / 60_000) * 60_000;

  // Ensure the bounds have at least 1 minute resolution.
  roundedStartValue = Math.min(roundedStartValue, roundedEndValue - 60_000);

  return {
    startValue: roundedStartValue,
    endValue: roundedEndValue,
  };
}

interface ZoomRenderProps {
  dataZoom: DataZoomComponentOption[];
  isGroupedByDate: boolean;
  notMerge: boolean;
  onChartReady: EChartChartReadyHandler;
  onDataZoom: EChartDataZoomHandler;
  onFinished: EChartFinishedHandler;
  replaceMerge: string[];
  toolBox: ToolboxComponentOption;
}

interface UseChartZoomOptions {
  /**
   * Disables toolbox zoom interactions and URL updates while preserving the
   * inside dataZoom model for synced charts.
   */
  disabled?: boolean;
  onZoom?: (period: FormattedPeriod) => void;
  /**
   * Use either `saveOnZoom` or `usePageDate` not both
   * Will persist zoom state to page filters
   */
  saveOnZoom?: boolean;
  /**
   * Use either `saveOnZoom` or `usePageDate` not both
   * Persists zoom state to query params without updating page filters.
   * Sets the start, end, and statsPeriod query params.
   */
  usePageDate?: boolean;
  xAxisIndex?: number | number[];
}

/**
 * Adds listeners to the document to allow for cancelling the zoom action
 */
function useChartZoomCancel(disabled?: boolean) {
  const chartInstance = useRef<ECharts | null>(null);
  const handleKeyDown = useCallback(
    (evt: KeyboardEvent) => {
      if (disabled || !chartInstance.current) {
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
    },
    [disabled]
  );

  const handleMouseUp = useCallback(() => {
    document.body.removeEventListener('mouseup', handleMouseUp);
    document.body.removeEventListener('keydown', handleKeyDown, true);
  }, [handleKeyDown]);

  const handleMouseDown = useCallback(() => {
    if (disabled) {
      return;
    }

    // Register `mouseup` and `keydown` listeners on mouse down
    // This ensures that there is only one live listener at a time
    // regardless of how many charts are rendered. NOTE: It's
    // important to set `useCapture: true` in the `"keydown"` handler
    // otherwise the Escape will close whatever modal or panel the
    // chart is in. Those elements register their handlers _earlier_.
    document.body.addEventListener('mouseup', handleMouseUp);
    document.body.addEventListener('keydown', handleKeyDown, true);
  }, [disabled, handleKeyDown, handleMouseUp]);

  const handleChartReady = useCallback<EChartChartReadyHandler>(
    chart => {
      if (chartInstance.current) {
        // remove listeners from previous chart if called multiple times
        chartInstance.current.getDom()?.removeEventListener('mousedown', handleMouseDown);
      }

      chartInstance.current = chart;
      const chartDom = chart.getDom();
      if (!disabled) {
        chartDom.addEventListener('mousedown', handleMouseDown);
      }
    },
    [disabled, handleMouseDown]
  );

  useEffect(() => {
    const chartDom = chartInstance.current?.getDom();

    if (disabled) {
      chartDom?.removeEventListener('mousedown', handleMouseDown);
      document.body.removeEventListener('mouseup', handleMouseUp);
      document.body.removeEventListener('keydown', handleKeyDown, true);
      return;
    }

    chartDom?.addEventListener('mousedown', handleMouseDown);

    return () => {
      // Cleanup listeners on unmount
      document.body.removeEventListener('mouseup', handleMouseUp);
      document.body.removeEventListener('keydown', handleKeyDown, true);
      chartDom?.removeEventListener('mousedown', handleMouseDown);
    };
  }, [disabled, handleKeyDown, handleMouseDown, handleMouseUp]);

  return {handleChartReady};
}

/**
 * This hook provides an alternative to using the `ChartZoom` component. It returns
 * the props that would be passed to the `BaseChart` as zoomRenderProps.
 */
export function useChartZoom({
  disabled,
  onZoom,
  usePageDate,
  saveOnZoom,
  xAxisIndex,
}: UseChartZoomOptions): ZoomRenderProps {
  const {handleChartReady} = useChartZoomCancel(disabled);
  const location = useLocation();
  const navigate = useNavigate();

  const commitZoomPeriod = useCallback(
    (formattedPeriod: FormattedPeriod) => {
      if (usePageDate) {
        const newQuery = {
          ...location.query,
          start: formattedPeriod.start,
          end: formattedPeriod.end,
          statsPeriod: formattedPeriod.period ?? undefined,
        };

        navigateIfQueryChanged(navigate, location, {query: newQuery});
      } else {
        updateDateTime(formattedPeriod, location, navigate, {save: saveOnZoom});
      }
    },
    [location, navigate, saveOnZoom, usePageDate]
  );

  const setPeriod = useCallback(
    (newPeriod: DateTimeUpdate) => {
      const formattedPeriod = getFormattedPeriod(newPeriod);

      // Callback to let parent component know zoom has changed.
      onZoom?.(formattedPeriod);

      commitZoomPeriod(formattedPeriod);
    },
    [commitZoomPeriod, onZoom]
  );

  const handleDataZoom = useCallback<EChartDataZoomHandler>(
    evt => {
      if (disabled) {
        return;
      }

      const range = getZoomRange(evt);
      const roundedRange = range ? roundZoomRange(range) : null;

      // If the range values are null, ECharts is restoring zoom history.
      if (!roundedRange) {
        return;
      }

      const {startValue, endValue} = roundedRange;

      setPeriod({
        period: null,
        start: getUtcDateString(startValue),
        end: getUtcDateString(endValue),
      });
    },
    [disabled, setPeriod]
  );

  /**
   * Chart event when *any* rendering+animation finishes
   *
   * Keep the hidden toolbox area-zoom cursor active after ECharts renders.
   */
  const handleChartFinished = useCallback<EChartFinishedHandler>(
    (_props, chart) => {
      if (disabled) {
        return;
      }

      activateZoomAreaSelect(chart);
    },
    [disabled]
  );

  const dataZoomProp = useMemo<DataZoomComponentOption[]>(() => {
    // Keep the inside dataZoom model even when disabled so synced charts can
    // still receive x-range changes without this hook writing URL state.
    const zoomInside = DataZoomInside({
      id: 'useChartZoom-inside',
      xAxisIndex,
    });
    return zoomInside;
  }, [xAxisIndex]);

  const toolBox = useMemo<ToolboxComponentOption>(() => {
    if (disabled) {
      // Remove the hidden toolbox while disabled so it cannot emit
      // URL-changing brush selections.
      return {};
    }

    return ToolBox(
      {id: 'useChartZoom-toolbox'},
      {
        dataZoom: {
          xAxisIndex,
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
    );
  }, [disabled, xAxisIndex]);

  const renderProps = useMemo<ZoomRenderProps>(
    () => ({
      ...CHART_ZOOM_MERGE_OPTIONS,
      dataZoom: dataZoomProp,
      toolBox,
      onDataZoom: handleDataZoom,
      onFinished: handleChartFinished,
      onChartReady: handleChartReady,
    }),
    [dataZoomProp, handleChartFinished, handleChartReady, handleDataZoom, toolBox]
  );

  return renderProps;
}
