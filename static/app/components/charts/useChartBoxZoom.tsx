import {type MutableRefObject, useCallback, useEffect, useRef} from 'react';
import {useTheme} from '@emotion/react';
import type {ECharts} from 'echarts';

import type {EChartChartReadyHandler} from 'sentry/types/echarts';
import {clamp} from 'sentry/utils/number/clamp';

export interface BoxZoomRange {
  /** The selected X-axis range. For a `time` axis, ms since epoch. */
  xRange: [number, number];
  /** The selected Y-axis range, in the axis's own units. */
  yRange: [number, number];
}

interface Point {
  x: number;
  y: number;
}

interface RectangularBounds {
  bottom: number;
  left: number;
  right: number;
  top: number;
}

interface UseChartBoxZoomProps {
  /**
   * Called on mouse-up with the selected x/y ranges of the dragged box, in the
   * data units of `xAxisIndex`/`yAxisIndex`. When omitted, drag-to-zoom is off.
   */
  onZoom?: (range: BoxZoomRange) => void;
  /**
   * The X-axis index to read the selection from. For the Heat Map this is the
   * readable `time` axis (index 1), not the hidden category axis the cells sit on.
   */
  xAxisIndex?: number;
  /**
   * The Y-axis index to read the selection from (the readable `value` axis).
   */
  yAxisIndex?: number;
}

interface BoxZoomOptions {
  isDraggingRef: MutableRefObject<boolean>;
  onChartReady: EChartChartReadyHandler;
}

/**
 * Drag-to-zoom for cartesian charts where a single drag selects a 2D region,
 * e.g., heat maps.
 *
 * ECharts' own gesture components don't fit here. `brush` re-renders every
 * series on mouse move which is too janky on a dense heat map. `dataZoom` binds
 * to the series' coordinate system which for a heat map that's the hidden
 * category axes the cells are laid out on. It's not the readable time/value
 * axes we want to zoom, so it can't read (or even resolve) those axes.
 *
 * We draw the selection rectangle ourselves as a plain fixed-position overlay
 * and on mouse-up convert its pixel corners to data values with
 * `convertFromPixel`.
 */
export function useChartBoxZoom({
  onZoom,
  xAxisIndex = 0,
  yAxisIndex = 0,
}: UseChartBoxZoomProps): BoxZoomOptions {
  const theme = useTheme();

  // Store refs for anything invoked inside the `onChartReady` handler. This
  // allows us to read up-to-date values inside hooks without having to add them
  // as hook dependencies. We don't want the hooks to re-run because ECharts
  // doesn't re-invoke `onChartReady` so we have just one shot to attach
  // listeners.
  const cleanupRef = useRef<(() => void) | null>(null);

  const isDraggingRef = useRef(false);

  const onZoomRef = useRef(onZoom);
  onZoomRef.current = onZoom;

  const axesIndecesRef = useRef({xAxisIndex, yAxisIndex});
  axesIndecesRef.current = {xAxisIndex, yAxisIndex};

  const overlayStyleRef = useRef({
    fill: theme.tokens.graphics.neutral.muted,
    zIndex: theme.zIndex.tooltip,
  });

  overlayStyleRef.current = {
    fill: theme.tokens.graphics.neutral.muted,
    zIndex: theme.zIndex.tooltip,
  };

  const onChartReady = useCallback<EChartChartReadyHandler>(chartInstance => {
    cleanupRef.current?.();
    cleanupRef.current = null;

    const dom = chartInstance.getDom();

    let start: Point = {x: 0, y: 0};
    let bounds: RectangularBounds | null = null;
    let $overlay: HTMLDivElement | null = null;
    let pointerId: number | null = null;
    let restoreTooltipTimer: ReturnType<typeof setTimeout> | null = null;

    function teardown() {
      dom.removeEventListener('pointermove', onPointerMove);
      dom.removeEventListener('pointerup', onPointerUp);
      dom.removeEventListener('lostpointercapture', onLostPointerCapture);
      document.removeEventListener('keydown', onKeyDown, true);
      if (pointerId !== null && dom.hasPointerCapture(pointerId)) {
        dom.releasePointerCapture(pointerId);
      }
      pointerId = null;
      $overlay?.remove();
      $overlay = null;
      bounds = null;
    }

    // Ends the drag and re-enables the tooltip. Restore is immediate for a
    // click/cancel. Restore is delayed for a drag zoom, so the tooltip doesn't
    // flash under the cursor.
    function endDrag(delayTooltipRestore = false) {
      teardown();
      if (delayTooltipRestore) {
        restoreTooltipTimer = setTimeout(() => {
          restoreTooltipTimer = null;
          isDraggingRef.current = false;
        }, TOOLTIP_RESTORE_DELAY_MS);
      } else {
        isDraggingRef.current = false;
      }
    }

    // If the chart moves under the fixed-position overlay mid-drag (page scroll,
    // resize, `autoHeightResize`), the selection no longer lines up with the
    // plot — cancel it rather than apply a mismatched zoom.
    function cancelDragOnChartMove() {
      if (bounds) {
        endDrag();
      }
    }

    function onPointerDown(evt: PointerEvent) {
      // Ignore the press when drag-zoom is off, it isn't the primary button, or
      // a drag is already in progress (e.g. a second touch pointer) — starting a
      // second selection would orphan the first overlay.
      if (!onZoomRef.current || evt.button !== 0 || bounds !== null) {
        return;
      }

      const currentBounds = getChartPlotBounds(chartInstance, getChartOrigin(dom));
      const point = mouseEventToPoint(evt);

      // Only start a selection when we can resolve the plot area and the press
      // lands inside it.
      if (!currentBounds || !doBoundsContainPoint(currentBounds, point)) {
        return;
      }

      bounds = currentBounds;
      isDraggingRef.current = true;
      start = point;
      pointerId = evt.pointerId;

      // A new drag starting during a pending restore cancels it.
      if (restoreTooltipTimer !== null) {
        clearTimeout(restoreTooltipTimer);
        restoreTooltipTimer = null;
      }

      // Route every subsequent event for this pointer to the chart element —
      // even outside the window — so we always get the terminating `pointerup`
      // and never leave a drag half-open.
      dom.setPointerCapture(pointerId);

      // Hide an already-open tooltip. Note that `hideTip` is much cheaper than
      // `setOption`
      chartInstance.dispatchAction({type: 'hideTip'});

      $overlay = createOverlay(overlayStyleRef.current);
      document.body.appendChild($overlay);
      updateOverlay($overlay, start, start);

      dom.addEventListener('pointermove', onPointerMove);
      dom.addEventListener('pointerup', onPointerUp);
      dom.addEventListener('lostpointercapture', onLostPointerCapture);
      document.addEventListener('keydown', onKeyDown, true);
    }

    dom.addEventListener('pointerdown', onPointerDown, true);

    // Cancel an active drag if the chart moves. `scroll` is capture-phase since
    // it doesn't bubble (the chart may sit in any scroll container); the
    // observer catches resizes. Both no-op unless a drag is in progress, so the
    // observer's initial callback (fired with no drag active) is ignored.
    document.addEventListener('scroll', cancelDragOnChartMove, true);
    const resizeObserver = new ResizeObserver(cancelDragOnChartMove);
    resizeObserver.observe(dom);

    cleanupRef.current = () => {
      dom.removeEventListener('pointerdown', onPointerDown, true);
      document.removeEventListener('scroll', cancelDragOnChartMove, true);
      resizeObserver.disconnect();
      if (restoreTooltipTimer !== null) {
        clearTimeout(restoreTooltipTimer);
      }
      isDraggingRef.current = false;
      teardown();
    };

    function onPointerMove(evt: PointerEvent) {
      // Only the captured pointer reshapes the box; a foreign pointer (e.g. a
      // second touch) reaching the chart DOM must be ignored.
      if (!$overlay || !bounds || evt.pointerId !== pointerId) {
        return;
      }

      updateOverlay($overlay, start, clampPointToBounds(mouseEventToPoint(evt), bounds));
    }

    function onPointerUp(evt: PointerEvent) {
      // Only the captured pointer's primary-button release completes the drag —
      // not a foreign pointer, and not a secondary/middle release with the
      // primary still held.
      if (!bounds || evt.button !== 0 || evt.pointerId !== pointerId) {
        return;
      }

      const end = clampPointToBounds(mouseEventToPoint(evt), bounds);

      // Resolve the zoom up front. A too-small drag, or a conversion that fails
      // (non-finite / collapsed range), yields null — no zoom. The origin is
      // read fresh here so a mid-drag chart move doesn't skew it.
      const range = isDragAboveThreshold(start, end)
        ? pixelBoxToDataRange(
            chartInstance,
            start,
            end,
            getChartOrigin(dom),
            axesIndecesRef.current
          )
        : null;

      // Delay the tooltip restore only when a zoom actually applies (navigation
      // follows and would otherwise flash it under the cursor); a click, tiny
      // drag, or failed conversion restores it immediately.
      endDrag(range !== null);

      if (range) {
        onZoomRef.current?.(range);
      }
    }

    // Capture can be lost without a `pointerup` (browser cancels the gesture,
    // the element is removed, etc.). It also fires *after* a normal `pointerup`,
    // but `endDrag` has already cleared `bounds` by then, so this no-ops.
    function onLostPointerCapture() {
      if (bounds) {
        endDrag();
      }
    }

    function onKeyDown(evt: KeyboardEvent) {
      if (evt.key === 'Escape') {
        evt.stopPropagation();
        endDrag();
      }
    }
  }, []);

  useEffect(() => () => cleanupRef.current?.(), []);

  return {onChartReady, isDraggingRef};
}

// Ignore selections smaller than this (px, on either axis): treat them as a
// click rather than a zoom.
const MIN_DRAG_PX = 5;

// How long, in ms, after a zoom before the hover tooltip is re-enabled.
const TOOLTIP_RESTORE_DELAY_MS = 200;

/** The chart DOM's top-left in client (viewport) space. */
function getChartOrigin(dom: HTMLElement): Point {
  const rect = dom.getBoundingClientRect();
  return {x: rect.left, y: rect.top};
}

function mouseEventToPoint(evt: MouseEvent): Point {
  return {x: evt.clientX, y: evt.clientY};
}

function doBoundsContainPoint(bounds: RectangularBounds, {x, y}: Point): boolean {
  return x >= bounds.left && x <= bounds.right && y >= bounds.top && y <= bounds.bottom;
}

function clampPointToBounds({x, y}: Point, bounds: RectangularBounds): Point {
  return {
    x: clamp(x, bounds.left, bounds.right),
    y: clamp(y, bounds.top, bounds.bottom),
  };
}

function isDragAboveThreshold(a: Point, b: Point): boolean {
  return Math.abs(b.x - a.x) >= MIN_DRAG_PX && Math.abs(b.y - a.y) >= MIN_DRAG_PX;
}

/**
 * Client-coordinate bounds of the chart's plot area (the grid, excluding
 * axis-label margins), so the selection can be clamped to it. Returns undefined
 * when the plot area can't be resolved — callers then don't start a selection
 * rather than zoom to fabricated bounds.
 *
 * `getRect` gives a chart-local `{x, y, width, height}`, which we shift by the
 * chart's viewport origin into client-space edges.
 */
function getChartPlotBounds(
  chart: ECharts,
  origin: Point
): RectangularBounds | undefined {
  // `getModel` and the coordinate-system rect aren't in ECharts' public types,
  // so reach for them via narrow structural casts.
  const model = (chart as unknown as {getModel?: () => unknown}).getModel?.();

  const grid = (
    model as {getComponent?: (mainType: string, idx: number) => unknown} | undefined
  )?.getComponent?.('grid', 0);

  const rect = (
    grid as {
      coordinateSystem?: {
        getRect?: () => {height: number; width: number; x: number; y: number};
      };
    }
  )?.coordinateSystem?.getRect?.();

  if (!rect) {
    return undefined;
  }

  return {
    left: origin.x + rect.x,
    top: origin.y + rect.y,
    right: origin.x + rect.x + rect.width,
    bottom: origin.y + rect.y + rect.height,
  };
}

/**
 * Convert two client-space pixel corners of a drag box into sorted data ranges
 * on the given axes. Offsets the corners into chart-local space by the chart's
 * viewport origin, then projects them with `convertFromPixel`. Returns `null` if
 * a corner falls outside a resolvable coordinate system (a non-finite
 * conversion), or if either axis collapses to zero width — a zoom to bounds that
 * match no data.
 */
function pixelBoxToDataRange(
  chart: ECharts,
  corner1: Point,
  corner2: Point,
  origin: Point,
  {xAxisIndex, yAxisIndex}: {xAxisIndex: number; yAxisIndex: number}
): BoxZoomRange | null {
  const ax = corner1.x - origin.x;
  const bx = corner2.x - origin.x;
  const ay = corner1.y - origin.y;
  const by = corner2.y - origin.y;

  const x0 = chart.convertFromPixel({xAxisIndex}, Math.min(ax, bx));
  const x1 = chart.convertFromPixel({xAxisIndex}, Math.max(ax, bx));
  const y0 = chart.convertFromPixel({yAxisIndex}, Math.min(ay, by));
  const y1 = chart.convertFromPixel({yAxisIndex}, Math.max(ay, by));

  // Reject non-finite conversions and selections that collapse on either axis:
  // a zero-width range resolves to bounds that match no data.
  if (![x0, x1, y0, y1].every(Number.isFinite) || x0 === x1 || y0 === y1) {
    return null;
  }

  return {
    xRange: [Math.min(x0, x1), Math.max(x0, x1)],
    yRange: [Math.min(y0, y1), Math.max(y0, y1)],
  };
}

function createOverlay({fill, zIndex}: {fill: string; zIndex: number}): HTMLDivElement {
  const el = document.createElement('div');
  Object.assign(el.style, {
    position: 'fixed',
    pointerEvents: 'none',
    zIndex: String(zIndex),
    background: fill,
    opacity: '0.5',
  });

  return el;
}

function updateOverlay(el: HTMLDivElement, a: Point, b: Point): void {
  el.style.left = `${Math.min(a.x, b.x)}px`;
  el.style.top = `${Math.min(a.y, b.y)}px`;
  el.style.width = `${Math.abs(b.x - a.x)}px`;
  el.style.height = `${Math.abs(b.y - a.y)}px`;
}
