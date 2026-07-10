import {useCallback, useEffect, useRef} from 'react';
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

    let restoreTooltipTimer: ReturnType<typeof setTimeout> | null = null;

    function scheduleTooltipRestore() {
      // Re-enable the tooltip a beat after release so it doesn't snap back under
      // the cursor the instant the drag ends.
      restoreTooltipTimer = setTimeout(() => {
        restoreTooltipTimer = null;
        chartInstance.setOption({tooltip: {show: true}}, {silent: true});
      }, TOOLTIP_RESTORE_DELAY_MS);
    }

    function teardown() {
      document.removeEventListener('mousemove', onMouseMove, true);
      document.removeEventListener('mouseup', onMouseUp, true);
      document.removeEventListener('keydown', onKeyDown, true);
      $overlay?.remove();
      $overlay = null;
      bounds = null;
    }

    function endDrag() {
      teardown();
      scheduleTooltipRestore();
    }

    // If the chart moves under the fixed-position overlay mid-drag (page scroll,
    // resize, `autoHeightResize`), the selection no longer lines up with the
    // plot — cancel it rather than apply a mismatched zoom.
    function cancelDragOnChartMove() {
      if (bounds) {
        endDrag();
      }
    }

    function onMouseDown(evt: MouseEvent) {
      if (!onZoomRef.current || evt.button !== 0) {
        return;
      }

      // Clear any drag that didn't tear down cleanly (e.g. a `mouseup` missed
      // because the button was released outside the window) so we never stack a
      // second overlay or duplicate listeners.
      teardown();

      const currentBounds = getChartPlotBounds(chartInstance, getChartOrigin(dom));
      const point = mouseEventToPoint(evt);

      // Only start a selection when we can resolve the plot area and the press
      // lands inside it.
      if (!currentBounds || !doBoundsContainPoint(currentBounds, point)) {
        return;
      }

      bounds = currentBounds;
      start = point;

      if (restoreTooltipTimer !== null) {
        clearTimeout(restoreTooltipTimer);
        restoreTooltipTimer = null;
      }

      // Hide the tooltip for the drag so it doesn't render over the selection.
      // `lazyUpdate` defers the re-render off the mousedown so the press is
      // snappy and we don't lose an active reference to the rectangle which
      // sometimes happens on chart re-render
      chartInstance.setOption({tooltip: {show: false}}, {silent: true, lazyUpdate: true});

      $overlay = createOverlay(overlayStyleRef.current);
      document.body.appendChild($overlay);
      updateOverlay($overlay, start, start);

      document.addEventListener('mousemove', onMouseMove, true);
      document.addEventListener('mouseup', onMouseUp, true);
      document.addEventListener('keydown', onKeyDown, true);
    }

    dom.addEventListener('mousedown', onMouseDown, true);

    // Cancel an active drag if the chart moves. `scroll` is capture-phase since
    // it doesn't bubble (the chart may sit in any scroll container); the
    // observer catches resizes. Both no-op unless a drag is in progress, so the
    // observer's initial callback (fired with no drag active) is ignored.
    document.addEventListener('scroll', cancelDragOnChartMove, true);
    const resizeObserver = new ResizeObserver(cancelDragOnChartMove);
    resizeObserver.observe(dom);

    cleanupRef.current = () => {
      dom.removeEventListener('mousedown', onMouseDown, true);
      document.removeEventListener('scroll', cancelDragOnChartMove, true);
      resizeObserver.disconnect();
      teardown();
      if (restoreTooltipTimer !== null) {
        clearTimeout(restoreTooltipTimer);
      }
    };

    function onMouseMove(evt: MouseEvent) {
      if (!$overlay || !bounds) {
        return;
      }

      // The primary button is no longer held — the `mouseup` was missed (e.g.
      // released outside the window). End the drag instead of tracking a phantom
      // one; don't apply a zoom since we never saw a real release.
      if ((evt.buttons & 1) === 0) {
        endDrag();
        return;
      }

      updateOverlay($overlay, start, clampPointToBounds(mouseEventToPoint(evt), bounds));
    }

    function onMouseUp(evt: MouseEvent) {
      // Only the primary button ends the drag; releasing a secondary/middle
      // button mid-drag (primary still held) must not tear down or zoom.
      if (!bounds || evt.button !== 0) {
        return;
      }

      const end = clampPointToBounds(mouseEventToPoint(evt), bounds);

      endDrag();

      if (!isDragAboveThreshold(start, end)) {
        return;
      }

      // Read the chart origin fresh at release rather than reusing the mousedown
      // one: if the chart moved during the drag (page scroll, resize), the fixed
      // overlay covers whatever cells sit under it *now*, so converting against
      // the current origin keeps the applied range matching what's on screen.
      const range = pixelBoxToDataRange(
        chartInstance,
        start,
        end,
        getChartOrigin(dom),
        axesIndecesRef.current
      );

      if (range) {
        onZoomRef.current?.(range);
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

  return {onChartReady};
}

// Ignore selections smaller than this (px, on either axis): treat them as a
// click rather than a zoom.
const MIN_DRAG_PX = 5;

// How long, in ms, after the drag ends before the hover tooltip is re-enabled,
// so it doesn't snap back under the cursor the instant the drag ends.
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
