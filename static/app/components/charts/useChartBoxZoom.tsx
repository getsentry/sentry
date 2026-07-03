import {useCallback, useEffect, useMemo, useRef} from 'react';
import type {BrushComponentOption, ToolboxComponentOption} from 'echarts';

import {ToolBox} from 'sentry/components/charts/components/toolBox';
import {
  pickBoxZoomRange,
  type BoxZoomRange,
} from 'sentry/components/charts/pickBoxZoomRange';
import type {
  EChartBrushEndHandler,
  EChartBrushStartHandler,
  EChartChartReadyHandler,
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
  onChartReady: EChartChartReadyHandler;
  toolBox: ToolboxComponentOption | undefined;
}

/**
 * Drag-to-zoom for cartesian charts where a single drag should select a 2D
 * region, e.g., heat maps. Uses ECharts' `brush` component.
 *
 * The brush is a global cursor that, while active, suppresses the series'
 * native hover emphasis. So rather than keeping it armed, the hook arms it only
 * while the mouse button is down (`mousedown` → `mouseup`) — a plain hover keeps
 * the chart's normal emphasis and tooltip. Arming happens in a capture-phase
 * `mousedown` listener so the cursor is set before ECharts handles the event and
 * can still capture that drag. Wire the returned `onChartReady` (and
 * `brush`/`toolBox`/`onBrushStart`/`onBrushEnd`) into the chart.
 */
export function useChartBoxZoom({
  onZoom,
  disabled = false,
  xAxisIndex = 0,
  yAxisIndex = 0,
}: UseChartBoxZoomProps): BoxZoomOptions {
  const cleanupRef = useRef<(() => void) | null>(null);

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

      // `pickBoxZoomRange` returns null for a degenerate selection (a click or a
      // zero-width drag on either axis), so those don't fire a zoom.
      const range = pickBoxZoomRange(evt.areas[0]);

      // Restore the tooltip and clear the drawn box: the zoom applies once.
      chartInstance.setOption({tooltip: {show: true}}, {silent: true});
      chartInstance.dispatchAction({type: 'brush', areas: []});

      if (range) {
        onZoom(range);
      }
    },
    [onZoom]
  );

  const onChartReady = useCallback<EChartChartReadyHandler>(
    chartInstance => {
      cleanupRef.current?.();
      cleanupRef.current = null;

      if (disabled) {
        return;
      }

      const dom = chartInstance.getDom();
      let armed = false;
      let frame: number | null = null;

      const arm = () => {
        chartInstance.dispatchAction({
          type: 'takeGlobalCursor',
          key: 'brush',
          brushOption,
        });
        armed = true;
      };

      const disarm = () => {
        if (!armed) {
          return;
        }
        armed = false;
        // Defer past the synchronous `brushend` this same mouseup fires, then
        // clear the global cursor so hovering shows normal emphasis again.
        frame = requestAnimationFrame(() => {
          chartInstance.dispatchAction({type: 'takeGlobalCursor'});
        });
      };

      // Arm on press (capture phase, so the cursor is set before ECharts handles
      // the mousedown and can capture this drag); disarm on release.
      dom.addEventListener('mousedown', arm, true);
      document.addEventListener('mouseup', disarm);

      cleanupRef.current = () => {
        dom.removeEventListener('mousedown', arm, true);
        document.removeEventListener('mouseup', disarm);
        if (frame !== null) {
          cancelAnimationFrame(frame);
        }
      };
    },
    [disabled, brushOption]
  );

  useEffect(() => () => cleanupRef.current?.(), []);

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
    onChartReady,
    toolBox,
  };
}
