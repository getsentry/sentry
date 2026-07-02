import {useCallback, useMemo} from 'react';
import type {BrushComponentOption, ToolboxComponentOption} from 'echarts';

import {ToolBox} from 'sentry/components/charts/components/toolBox';
import {
  pickBoxZoomRange,
  type BoxZoomRange,
} from 'sentry/components/charts/pickBoxZoomRange';
import type {
  ECharts,
  EChartBrushEndHandler,
  EChartBrushStartHandler,
  EChartFinishedHandler,
} from 'sentry/types/echarts';

export type {BoxZoomRange};

interface UseChartBoxZoomProps {
  /**
   * Called once on mouse-up with the selected x/y ranges of the dragged box.
   */
  onZoom: (range: BoxZoomRange) => void;
  /**
   * When true, drag-to-zoom is not installed.
   */
  disabled?: boolean;
  /**
   * The index of the X-axis the brush maps to. Maybe be non-zero depending on
   * whether the brushed chart adds more axes (especially hidden ones, like Heat
   * Map)
   */
  xAxisIndex?: number;
  /**
   * The index of the Y-axis the brush maps to.
   */
  yAxisIndex?: number;
}

interface BoxZoomOptions {
  brush: BrushComponentOption | undefined;
  onBrushEnd: EChartBrushEndHandler;
  onBrushStart: EChartBrushStartHandler;
  onFinished: EChartFinishedHandler;
  toolBox: ToolboxComponentOption | undefined;
}

/**
 * Drag-to-zoom for cartesian charts where a single drag should select a 2D
 * region, e.g., heat maps. Uses ECharts' `brush` component.
 *
 * Brush mode is a global cursor that ECharts drops on every `setOption`, so the
 * hook re-arms it on the chart's `finished` event (fires after the initial
 * render, every data refresh, and each brush clear) — the same approach
 * `useChartZoom` uses for its dataZoom area-select. Wire the returned
 * `onFinished` (and `brush`/`toolBox`/`onBrushStart`/`onBrushEnd`) into the chart.
 */
export function useChartBoxZoom({
  onZoom,
  disabled = false,
  xAxisIndex = 0,
  yAxisIndex = 0,
}: UseChartBoxZoomProps): BoxZoomOptions {
  const brushOption = useMemo<BrushComponentOption>(
    () => ({
      mainType: 'brush',
      toolbox: ['rect', 'clear'],
      brushMode: 'single',
      brushType: 'rect',
      throttleType: 'debounce',
      throttleDelay: 100,
      xAxisIndex,
      yAxisIndex,
      brushStyle: {},
      removeOnClick: false,
      transformable: false,
    }),
    [xAxisIndex, yAxisIndex]
  );

  const enableBrushMode = useCallback(
    (chartInstance: ECharts) => {
      chartInstance.dispatchAction({
        type: 'takeGlobalCursor',
        key: 'brush',
        brushOption,
      });
    },
    [brushOption]
  );

  const onBrushStart = useCallback<EChartBrushStartHandler>((_evt, chartInstance) => {
    // Hide the hover tooltip while dragging so it doesn't cover the selection.
    chartInstance.dispatchAction({type: 'hideTip'});
    chartInstance.setOption({tooltip: {show: false}}, {silent: true});
  }, []);

  const onBrushEnd = useCallback<EChartBrushEndHandler>(
    (evt, chartInstance) => {
      if (!chartInstance) {
        return;
      }

      const area = evt.areas[0];
      const range = pickBoxZoomRange(area);

      // Restore the tooltip and clear the drawn box: the zoom applies once. The
      // resulting render re-arms brush mode via `onFinished`.
      chartInstance.setOption({tooltip: {show: true}}, {silent: true});
      chartInstance.dispatchAction({type: 'brush', areas: []});

      // Ignore selections too small to be an intentional drag (a stray click or
      // tiny nudge) — they'd resolve to an empty range on the collapsed axis.
      if (range && isIntentionalDrag(area?.range)) {
        onZoom(range);
      }
    },
    [onZoom]
  );

  // ECharts drops the global brush cursor on every `setOption`, so re-arm it
  // each time rendering finishes — the initial render, data refreshes, and the
  // re-render after each brush clears.
  const onFinished = useCallback<EChartFinishedHandler>(
    (_props, chartInstance) => {
      if (!disabled) {
        enableBrushMode(chartInstance);
      }
    },
    [disabled, enableBrushMode]
  );

  const toolBox = useMemo<ToolboxComponentOption | undefined>(() => {
    if (disabled) {
      return;
    }
    // Hidden: we enable brush selection programmatically via `takeGlobalCursor`.
    return ToolBox({show: false}, {brush: {type: ['rect']}});
  }, [disabled]);

  return {
    brush: disabled ? undefined : brushOption,
    onBrushEnd,
    onBrushStart,
    onFinished,
    toolBox,
  };
}

/**
 * A drag smaller than this on either axis (in pixels) is treated as a stray
 * click or nudge rather than a zoom.
 */
const MIN_BRUSH_SIZE_PX = 5;

/**
 * Whether the brush's pixel `range` (`[[x0, x1], [y0, y1]]`) is large enough on
 * both axes to count as an intentional drag. Unmeasurable shapes pass through so
 * we never block a real zoom.
 */
function isIntentionalDrag(range: number[] | number[][] | undefined): boolean {
  if (!Array.isArray(range) || !Array.isArray(range[0]) || !Array.isArray(range[1])) {
    return true;
  }
  const [x0, x1] = range[0];
  const [y0, y1] = range[1];
  if (
    typeof x0 !== 'number' ||
    typeof x1 !== 'number' ||
    typeof y0 !== 'number' ||
    typeof y1 !== 'number'
  ) {
    return true;
  }
  return Math.abs(x1 - x0) >= MIN_BRUSH_SIZE_PX && Math.abs(y1 - y0) >= MIN_BRUSH_SIZE_PX;
}
