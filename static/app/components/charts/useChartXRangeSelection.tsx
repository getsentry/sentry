import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type DependencyList,
} from 'react';
import {createPortal} from 'react-dom';
import type {BrushComponentOption, EChartsOption, ToolboxComponentOption} from 'echarts';
import * as echarts from 'echarts';
import type EChartsReact from 'echarts-for-react';
import type {EChartsInstance} from 'echarts-for-react';

import ToolBox from 'sentry/components/charts/components/toolBox';
import type {EChartBrushEndHandler, EChartBrushStartHandler} from 'sentry/types/echarts';

export type Selection = {
  /**
   * The panel ID of the selection box that echarts assigns. It's a special encoded string, so we collect it here instead of hardcoding it.
   * We need this to draw a selection box programmatically, like on load from the initial state in the url.
   */
  panelId: string;

  range: [number, number];
};

type State = {
  actionMenuPosition: {left: number; position: 'left' | 'right'; top: number} | null;
  selection: Selection;
} | null;

type BoxSelectionOptions = {
  /**
   * The brush option override for the chart, to enable brush mode.
   */
  brush: EChartsOption['brush'];

  /**
   * The callback that the chart calls when dragging ends.
   */
  onBrushEnd: EChartBrushEndHandler;

  /**
   * The callback that the chart calls when dragging starts.
   */
  onBrushStart: EChartBrushStartHandler;

  /**
   * The tool box override  for the chart. Must be passed on to the chart to enable the brush mode.
   */
  toolBox: ToolboxComponentOption | undefined;

  /**
   * The floating action menu that is displayed when the user finishes dragging.
   */
  ActionMenu?: React.ReactNode;
};

const CHART_X_RANGE_BRUSH_OPTION: BrushComponentOption = {
  mainType: 'brush',
  toolbox: ['rect', 'clear'],
  brushMode: 'single',
  brushType: 'lineX',
  throttleType: 'debounce',
  throttleDelay: 100,
  xAxisIndex: 0,
  brushStyle: {},
  removeOnClick: false,
  transformable: true,
};

export type ChartXRangeSelectionProps = {
  /**
   * The ref to the chart component.
   */
  chartRef: React.RefObject<EChartsReact | null>;

  /**
   * The renderer for the action menu that is displayed when the selection/dragging ends.
   */
  actionMenuRenderer?: (
    selection: Selection,
    clearSelection: () => void
  ) => React.ReactNode;

  /**
   * In the case of multiple charts, this is the name of the chart's group.
   */
  chartsGroupName?: string;

  /**
   * The dependencies to be used to re-activate selection or re-paint the box.
   */
  deps?: DependencyList;

  /**
   * Whether selection is disabled.
   */
  disabled?: boolean;

  /**
   * The callback that is called when the selection is cleared.
   */
  onClearSelection?: () => void;

  /**
   * The callback that is called when the selection/dragging ends.
   */
  onSelectionEnd?: (selection: Selection, clearSelection: () => void) => void;

  /**
   * The callback that is called when the selection/dragging starts.
   */
  onSelectionStart?: () => void;
};

export function useChartXRangeSelection({
  chartRef,
  onSelectionEnd,
  onSelectionStart,
  onClearSelection,
  actionMenuRenderer,
  chartsGroupName,
  disabled = false,
  deps = [],
}: ChartXRangeSelectionProps): BoxSelectionOptions {
  const [state, setState] = useState<State>();
  const tooltipFrameRef = useRef<number | null>(null);
  const enableBrushModeFrameRef = useRef<number | null>(null);

  const onBrushStart = useCallback<EChartBrushStartHandler>(
    (_evt, chartInstance) => {
      // Echarts either lets us connect all interactivity of the charts in a group or none of them.
      // We need connectivity for cursor syncing, but having that enabled while drawing, leads to a
      // box drawn for all of the charts in the group. We are going for chart specific box selections,
      // so we disconnect the group while drawing.
      if (chartsGroupName) {
        echarts?.disconnect(chartsGroupName);
      }

      chartInstance.dispatchAction({type: 'hideTip'});

      // Disable the tooltip as we start dragging, as it covers regions of the chart that the user
      // may want to select. The tooltip remains hidden until the box is cleared.
      if (tooltipFrameRef.current) cancelAnimationFrame(tooltipFrameRef.current);

      tooltipFrameRef.current = requestAnimationFrame(() => {
        chartInstance.setOption(
          {
            tooltip: {show: false},
          },
          {silent: true}
        );
      });

      onSelectionStart?.();
    },
    [chartsGroupName, onSelectionStart]
  );

  const clearSelection = useCallback(() => {
    if (!state?.selection) return;

    const chartInstance = chartRef.current?.getEchartsInstance();

    chartInstance?.dispatchAction({type: 'brush', areas: []});

    // Restore the tooltip as we clear selection
    if (tooltipFrameRef.current) cancelAnimationFrame(tooltipFrameRef.current);

    tooltipFrameRef.current = requestAnimationFrame(() => {
      chartInstance?.setOption({tooltip: {show: true}}, {silent: true});
    });

    setState(null);

    onClearSelection?.();
  }, [chartRef, onClearSelection, state?.selection]);

  const onBrushEnd = useCallback<EChartBrushEndHandler>(
    (evt, chartInstance) => {
      if (!chartInstance) return;

      // @ts-expect-error TODO Abdullah Khan: chartInstance.getModel is a private method, but we access it to get the axis extremes
      // could not find a better way, this works out perfectly for now. Passing down the entire series data to the hook is more gross.
      const xAxis = chartInstance.getModel().getComponent('xAxis', 0);

      // @ts-expect-error TODO Abdullah Khan: chartInstance.getModel is a private method, but we access it to get the axis extremes
      // could not find a better way, this works out perfectly for now. Passing down the entire series data to the hook is more gross.
      const yAxis = chartInstance.getModel().getComponent('yAxis', 0);

      // Get the minimum and maximum values of the x axis and y axis
      const xMin = xAxis.axis.scale.getExtent()[0];
      const xMax = xAxis.axis.scale.getExtent()[1];
      const yMin = yAxis.axis.scale.getExtent()[0];

      const xMaxPixel = chartInstance.convertToPixel({xAxisIndex: 0}, xMax);
      const yMinPixel = chartInstance.convertToPixel({yAxisIndex: 0}, yMin);

      const area = evt.areas[0];

      if (
        area &&
        Array.isArray(area.coordRange) &&
        area.coordRange.length === 2 &&
        typeof area.coordRange[0] === 'number' &&
        typeof area.coordRange[1] === 'number'
      ) {
        const [selected_xMin, selected_xMax] = area.coordRange;

        // Since we can keep dragging beyond the visible range,
        // clamp the ranges to the minimum and maximum values of the visible x axis and y axis
        const clampedCoordRange: [number, number] = [
          Math.max(xMin, selected_xMin),
          Math.min(xMax, selected_xMax),
        ];

        const clampedXMaxPixel = chartInstance.convertToPixel(
          {xAxisIndex: 0},
          clampedCoordRange[1]
        );
        const clampedXMinPixel = chartInstance.convertToPixel(
          {xAxisIndex: 0},
          clampedCoordRange[0]
        );

        const newSelection: Selection = {
          range: clampedCoordRange,
          panelId: area.panelId,
        };

        const actionMenuPosition = calculateActionMenuPosition({
          chartInstance,
          clampedXMaxPixel,
          clampedXMinPixel,
          xMaxPixel,
          yMinPixel,
        });

        setState({
          selection: newSelection,
          actionMenuPosition,
        });

        onSelectionEnd?.(newSelection, clearSelection);
      }
    },
    [onSelectionEnd, clearSelection]
  );

  const handleOutsideClick = useCallback(
    (event: MouseEvent) => {
      let el = event.target as HTMLElement | null;

      // Propagate the click event to the parent elements until we find the element that has the
      // data-explore-chart-selection-region attribute. This is used to prevent the selection from
      // being cleared if the user clicks within an 'inbound' region.
      while (el) {
        if (el.dataset?.exploreChartSelectionRegion !== undefined) {
          return;
        }
        el = el.parentElement;
      }

      clearSelection();
    },
    [clearSelection]
  );

  useEffect(() => {
    if (disabled || !state?.selection) return;

    window.addEventListener('click', handleOutsideClick, {capture: true});

    // eslint-disable-next-line consistent-return
    return () => {
      window.removeEventListener('click', handleOutsideClick, {capture: true});
    };
  }, [handleOutsideClick, disabled, state?.selection]);

  const enableBrushMode = useCallback(() => {
    const chartInstance = chartRef.current?.getEchartsInstance();
    chartInstance?.dispatchAction({
      type: 'takeGlobalCursor',
      key: 'brush',
      brushOption: CHART_X_RANGE_BRUSH_OPTION,
    });
  }, [chartRef]);

  useEffect(() => {
    if (disabled) {
      return;
    }

    const chartInstance = chartRef.current?.getEchartsInstance();

    // Re-draw the box in the chart when a new selection is made
    if (state?.selection) {
      chartInstance?.dispatchAction({
        type: 'brush',
        areas: [
          {
            brushType: 'lineX',
            coordRange: state.selection.range,
            coordRanges: [state.selection.range],
            panelId: state.selection.panelId,
          },
        ],
      });

      // We re-connect the group after drawing the box, so that the cursor is synced across all charts again.
      // Check the onBrushStart handler for more details.
      if (chartsGroupName) {
        echarts?.connect(chartsGroupName);
      }
    }

    // Activate brush mode on load and when we re-draw the box/clear the selection
    enableBrushModeFrameRef.current = requestAnimationFrame(() => {
      enableBrushMode();
    });

    // eslint-disable-next-line consistent-return
    return () => {
      if (enableBrushModeFrameRef.current)
        cancelAnimationFrame(enableBrushModeFrameRef.current);
      if (tooltipFrameRef.current) cancelAnimationFrame(tooltipFrameRef.current);
    };
  }, [state, disabled, enableBrushMode, chartRef, chartsGroupName, deps]);

  const brush: BrushComponentOption | undefined = useMemo(() => {
    return disabled ? undefined : CHART_X_RANGE_BRUSH_OPTION;
  }, [disabled]);

  const toolBox = useMemo<ToolboxComponentOption | undefined>(() => {
    if (disabled) {
      return undefined;
    }

    return ToolBox(
      {
        show: false, // Prevent the toolbox from being shown, we enable selection on load
      },
      {
        brush: {
          type: ['lineX'],
        },
      }
    );
  }, [disabled]);

  const renderedActionMenu = useMemo(() => {
    if (!state?.actionMenuPosition || !actionMenuRenderer) return null;

    // We want the top right corner of the action menu to be aligned with the bottom left
    // corner of the selection box, when the menu is positioned to the left. Using a transform, saves us
    // form having to calculate the exact position of the menu.
    const transform =
      state.actionMenuPosition.position === 'left' ? 'translateX(-100%)' : 'none';

    return createPortal(
      <div
        data-explore-chart-selection-region
        style={{
          position: 'absolute',
          transform,
          whiteSpace: 'nowrap',
          top: state.actionMenuPosition.top,
          left: state.actionMenuPosition.left,
          zIndex: 1000,
        }}
      >
        {actionMenuRenderer(state.selection, clearSelection)}
      </div>,
      document.body
    );
  }, [state, actionMenuRenderer, clearSelection]);

  const options: BoxSelectionOptions = useMemo(() => {
    return {
      brush,
      onBrushEnd,
      onBrushStart,
      toolBox,
      ActionMenu: renderedActionMenu,
    };
  }, [onBrushEnd, brush, toolBox, onBrushStart, renderedActionMenu]);

  return options;
}

function calculateActionMenuPosition({
  chartInstance,
  clampedXMaxPixel,
  clampedXMinPixel,
  xMaxPixel,
  yMinPixel,
}: {
  chartInstance: EChartsInstance;
  clampedXMaxPixel: number;
  clampedXMinPixel: number;
  xMaxPixel: number;
  yMinPixel: number;
}) {
  let leftOffset: number;
  let position: 'left' | 'right';
  const chartRect = chartInstance.getDom().getBoundingClientRect();

  // If the point that we stop dragging is to the right of 60% of the width of the chart,
  // position the action menu to the bottom-left of the box. Otherwise, position it to the
  // bottom-right of the box.
  if (clampedXMaxPixel > 0.6 * xMaxPixel) {
    position = 'left';
    leftOffset = clampedXMinPixel;
  } else {
    position = 'right';
    leftOffset = clampedXMaxPixel;
  }

  return {
    position,
    left: chartRect.left + leftOffset,
    top: chartRect.top + yMinPixel + window.scrollY,
  };
}
