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
import usePrevious from 'sentry/utils/usePrevious';

export type Selection = {
  /**
   * The panel ID of the selection box that echarts assigns. It's a special encoded string, so we collect it here instead of hardcoding it.
   * We need this to draw a selection box programmatically, like on load from the initial state in the url.
   */
  panelId: string;

  range: [number, number];
};

type SelectionState = {
  actionMenuPosition: {left: number; position: 'left' | 'right'; top: number} | null;
  isActionMenuVisible: boolean;
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
  transformable: false,
};

export type SelectionCallbackParams = {
  clearSelection: () => void;
  selectionState: SelectionState;
  setSelectionState: (selectionState: SelectionState) => void;
};

export type ChartXRangeSelectionProps = {
  /**
   * The ref to the chart component.
   */
  chartRef: React.RefObject<EChartsReact | null>;

  /**
   * The renderer for the action menu that is displayed when the selection/dragging ends.
   */
  actionMenuRenderer?: (params: SelectionCallbackParams) => React.ReactNode;

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
   * Initial selection, used to draw the box on load.
   */
  initialSelection?: Selection;

  /**
   * The callback that is called when the selection is cleared.
   */
  onClearSelection?: (params: SelectionCallbackParams) => void;

  /**
   * The callback that is called when the chart is clicked inside the selection box.
   */
  onInsideSelectionClick?: (params: SelectionCallbackParams) => void;

  /**
   * The callback that is called when the chart is clicked outside the selection box and the action menu.
   */
  onOutsideSelectionClick?: (params: SelectionCallbackParams) => void;

  /**
   * The callback that is called when the selection/dragging ends.
   */
  onSelectionEnd?: (params: SelectionCallbackParams) => void;

  /**
   * The callback that is called when the selection/dragging starts.
   */
  onSelectionStart?: (params: SelectionCallbackParams) => void;
};

export function useChartXRangeSelection({
  chartRef,
  onSelectionEnd,
  onSelectionStart,
  onClearSelection,
  onInsideSelectionClick,
  onOutsideSelectionClick,
  actionMenuRenderer,
  chartsGroupName,
  initialSelection,
  disabled = false,
  deps = [],
}: ChartXRangeSelectionProps): BoxSelectionOptions {
  const [selectionState, setSelectionState] = useState<SelectionState>(null);

  const tooltipFrameRef = useRef<number | null>(null);
  const brushStateSyncFrameRef = useRef<number | null>(null);

  const previousInitialSelection = usePrevious(initialSelection);

  const clearSelection = useCallback(() => {
    if (!selectionState?.selection) return;

    const chartInstance = chartRef.current?.getEchartsInstance();

    chartInstance?.dispatchAction({type: 'brush', areas: []});

    // Restore the tooltip as we clear selection
    if (tooltipFrameRef.current) cancelAnimationFrame(tooltipFrameRef.current);

    tooltipFrameRef.current = requestAnimationFrame(() => {
      chartInstance?.setOption({tooltip: {show: true}}, {silent: true});
    });

    setSelectionState(null);

    onClearSelection?.({selectionState, setSelectionState, clearSelection});
  }, [chartRef, onClearSelection, selectionState]);

  const callbackParams = useMemo<SelectionCallbackParams>(() => {
    return {selectionState, setSelectionState, clearSelection};
  }, [selectionState, setSelectionState, clearSelection]);

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

      onSelectionStart?.(callbackParams);
    },
    [chartsGroupName, onSelectionStart, callbackParams]
  );

  const onBrushEnd = useCallback<EChartBrushEndHandler>(
    (evt, chartInstance) => {
      if (!chartInstance) return;

      const area = evt.areas[0];

      if (
        area &&
        Array.isArray(area.coordRange) &&
        area.coordRange.length === 2 &&
        typeof area.coordRange[0] === 'number' &&
        typeof area.coordRange[1] === 'number'
      ) {
        const newState = calculateNewState({
          chartInstance,
          newRange: area.coordRange as [number, number],
          panelId: area.panelId,
        });

        setSelectionState(newState);

        if (newState) {
          onSelectionEnd?.({
            selectionState: newState,
            setSelectionState,
            clearSelection,
          });
        }
      }
    },
    [onSelectionEnd, setSelectionState, clearSelection]
  );

  const enableBrushMode = useCallback(() => {
    const chartInstance = chartRef.current?.getEchartsInstance();
    chartInstance?.dispatchAction({
      type: 'takeGlobalCursor',
      key: 'brush',
      brushOption: CHART_X_RANGE_BRUSH_OPTION,
    });
  }, [chartRef]);

  const syncSelectionStates = useCallback(() => {
    if (disabled) return;

    const chartInstance = chartRef.current?.getEchartsInstance();

    if (!chartInstance) {
      return;
    }

    const hasInitialSelectionChanged = previousInitialSelection !== initialSelection;

    // Initial selection changed to undefined, so we clear the selection
    // Example: Back navigation to an unselected chart region state
    if (hasInitialSelectionChanged && !initialSelection) {
      clearSelection();
      return;
    }

    // No initial selection to sync
    if (!initialSelection) {
      return;
    }

    // Determine if we need to update state. This is the case when:
    // 1. No current selection state BUT initialSelection is defined, so we initialize the selection state
    // 2. Initial selection changed and range is different.
    //    Example: Back navigation from one selected chart region state to another selected chart region state.
    const hasRangeChanged =
      selectionState &&
      (selectionState.selection.range[0] !== initialSelection.range[0] ||
        selectionState.selection.range[1] !== initialSelection.range[1]);

    const newState = calculateNewState({
      chartInstance,
      newRange: initialSelection.range,
      panelId: initialSelection.panelId,
    });

    // If we couldn't calculate a new state (ex: out of bounds selection), we clear selection
    if (!newState) {
      clearSelection();
      return;
    }

    const shouldUpdateState =
      !selectionState || (hasInitialSelectionChanged && hasRangeChanged);

    if (!shouldUpdateState) {
      return;
    }

    setSelectionState(newState);
  }, [
    initialSelection,
    selectionState,
    clearSelection,
    chartRef,
    previousInitialSelection,
    disabled,
  ]);

  useEffect(() => {
    if (disabled || !selectionState?.selection) return;

    const chartInstance = chartRef.current?.getEchartsInstance();
    if (!chartInstance) return;

    const handleInsideSelectionClick = (event: MouseEvent) => {
      const [selectedMin, selectedMax] = selectionState.selection.range;

      const xMinPixel = chartInstance.convertToPixel({xAxisIndex: 0}, selectedMin);
      const xMaxPixel = chartInstance.convertToPixel({xAxisIndex: 0}, selectedMax);

      // @ts-expect-error TODO Abdullah Khan: chartInstance.getModel is a private method, but we access it to get the axis extremes
      // could not find a better way, this works out perfectly for now. Passing down the entire series data to the hook is more gross.
      const yAxis = chartInstance.getModel()?.getComponent?.('yAxis', 0);
      if (!yAxis) return;

      const yMin = yAxis.axis.scale.getExtent()[0];
      const yMinPixel = chartInstance.convertToPixel({yAxisIndex: 0}, yMin);

      const chartRect = chartInstance.getDom().getBoundingClientRect();

      const left = chartRect.left + xMinPixel;
      const right = chartRect.left + xMaxPixel;
      const top = chartRect.top;
      const bottom = chartRect.top + yMinPixel;

      const {clientX, clientY} = event;

      if (clientX >= left && clientX <= right && clientY >= top && clientY <= bottom) {
        onInsideSelectionClick?.(callbackParams);
        return;
      }

      // Check if the click was on an element that is a child of the action menu
      // to prevent triggering the onOutsideSelectionClick callback. The action menu items
      // have their own onClick handlers.
      let el = event.target as HTMLElement | null;
      while (el) {
        if (el.dataset?.chartXRangeSelectionActionMenu !== undefined) {
          return;
        }
        el = el.parentElement;
      }

      onOutsideSelectionClick?.(callbackParams);
    };

    document.body.addEventListener('click', handleInsideSelectionClick, true);

    // eslint-disable-next-line consistent-return
    return () => {
      document.body.removeEventListener('click', handleInsideSelectionClick, true);
    };
  }, [
    disabled,
    selectionState,
    chartRef,
    onInsideSelectionClick,
    onOutsideSelectionClick,
    callbackParams,
  ]);

  // This effect fires whenever state changes. It:
  // - Re-draws the selection box in the chart on state change enforcing persistence.
  // - Populates the rest of the state from the optional `initialSelection` prop on load.
  // - Activates brush mode on load and when we re-draw the box/clear the selection.
  useEffect(() => {
    if (disabled) {
      return;
    }

    const chartInstance = chartRef.current?.getEchartsInstance();

    if (!chartInstance) {
      return;
    }

    // Re-draw the box in the chart whenever state.selection changes,
    // enforcing persistence.
    if (selectionState?.selection) {
      chartInstance.dispatchAction({
        type: 'brush',
        areas: [
          {
            brushType: 'lineX',
            coordRange: selectionState.selection.range,
            coordRanges: [selectionState.selection.range],
            panelId: selectionState.selection.panelId,
          },
        ],
      });

      // We re-connect the group after drawing the box, so that the cursor is synced across all charts again.
      // Check the onBrushStart handler for more details.
      if (chartsGroupName) {
        echarts?.connect(chartsGroupName);
      }
    }

    if (brushStateSyncFrameRef.current) {
      cancelAnimationFrame(brushStateSyncFrameRef.current);
    }

    // Everything inside `requestAnimationFrame` is called only after the current render cycle completes,
    // and this ensures ECharts has fully processed all the dispatchActions like the one above.
    brushStateSyncFrameRef.current = requestAnimationFrame(() => {
      syncSelectionStates();
      enableBrushMode();
    });

    // eslint-disable-next-line consistent-return
    return () => {
      if (brushStateSyncFrameRef.current) {
        cancelAnimationFrame(brushStateSyncFrameRef.current);
      }

      if (tooltipFrameRef.current) {
        cancelAnimationFrame(tooltipFrameRef.current);
      }
    };
  }, [
    selectionState,
    disabled,
    enableBrushMode,
    chartRef,
    chartsGroupName,
    initialSelection,
    deps,
    syncSelectionStates,
  ]);

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
    if (
      !selectionState?.actionMenuPosition ||
      !actionMenuRenderer ||
      !selectionState.isActionMenuVisible
    )
      return null;

    // We want the top right corner of the action menu to be aligned with the bottom left
    // corner of the selection box, when the menu is positioned to the left. Using a transform, saves us
    // form having to calculate the exact position of the menu.
    const transform =
      selectionState.actionMenuPosition.position === 'left'
        ? 'translateX(-100%)'
        : 'none';

    return createPortal(
      <div
        data-chart-x-range-selection-action-menu
        style={{
          position: 'absolute',
          transform,
          whiteSpace: 'nowrap',
          top: selectionState.actionMenuPosition.top,
          left: selectionState.actionMenuPosition.left,
          zIndex: 1000,
        }}
      >
        {actionMenuRenderer(callbackParams)}
      </div>,
      document.body
    );
  }, [selectionState, actionMenuRenderer, callbackParams]);

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

function calculateNewState({
  chartInstance,
  newRange,
  panelId,
}: {
  chartInstance: EChartsInstance;
  newRange: [number, number];
  panelId: string;
}): SelectionState {
  // @ts-expect-error TODO Abdullah Khan: chartInstance.getModel is a private method, but we access it to get the axis extremes
  // could not find a better way, this works out perfectly for now. Passing down the entire series data to the hook is more gross.
  const xAxis = chartInstance.getModel()?.getComponent?.('xAxis', 0);

  // @ts-expect-error TODO Abdullah Khan: chartInstance.getModel is a private method, but we access it to get the axis extremes
  // could not find a better way, this works out perfectly for now. Passing down the entire series data to the hook is more gross.
  const yAxis = chartInstance.getModel()?.getComponent?.('yAxis', 0);

  if (!xAxis || !yAxis) {
    return null;
  }

  // Get the minimum and maximum values of the x axis and y axis
  const xMin = xAxis.axis.scale.getExtent()[0];
  const xMax = xAxis.axis.scale.getExtent()[1];
  const yMin = yAxis.axis.scale.getExtent()[0];

  const xMaxPixel = chartInstance.convertToPixel({xAxisIndex: 0}, xMax);
  const yMinPixel = chartInstance.convertToPixel({yAxisIndex: 0}, yMin);
  const [selected_xMin, selected_xMax] = newRange;

  // If the selection is completely out of bounds, return null
  if (selected_xMin > xMax || selected_xMax < xMin) {
    return null;
  }

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

  const actionMenuPosition = calculateActionMenuPosition({
    chartInstance,
    clampedXMaxPixel,
    clampedXMinPixel,
    xMaxPixel,
    yMinPixel,
  });

  return {
    actionMenuPosition,
    selection: {
      range: clampedCoordRange,
      panelId,
    },
    isActionMenuVisible: true,
  };
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
}): {left: number; position: 'left' | 'right'; top: number} {
  // Calculate the position of the action menu
  let leftOffset: number;
  let position: 'left' | 'right';
  const chartRect = chartInstance.getDom().getBoundingClientRect();

  // If the point that we stop dragging is to the right of 60% of the width of the chart,
  // position the action menu to the bottom-left of the box. Otherwise, position it to the
  // bottom-right of the box.
  if (clampedXMaxPixel > 0.6 * xMaxPixel) {
    position = 'left';

    // -1 to account for the border of the drawn box
    leftOffset = clampedXMinPixel - 1;
  } else {
    position = 'right';

    // +1 to account for the border of the drawn box
    leftOffset = clampedXMaxPixel + 1;
  }

  return {
    position,
    left: chartRect.left + leftOffset,
    top: chartRect.top + yMinPixel + window.scrollY,
  };
}
