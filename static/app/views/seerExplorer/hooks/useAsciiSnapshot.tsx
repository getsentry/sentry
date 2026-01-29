import {useCallback} from 'react';
import * as echarts from 'echarts/core';

import {
  aggregateFunctionOutputType,
  parseFunction,
  prettifyParsedFunction,
  RateUnit,
} from 'sentry/utils/discover/fields';
import {
  formatAbbreviatedNumberWithDynamicPrecision,
  formatRate,
} from 'sentry/utils/formatters';
import {formatMetricUsingUnit} from 'sentry/utils/number/formatMetricUsingUnit';
import usePageFilters from 'sentry/utils/usePageFilters';
import useProjects from 'sentry/utils/useProjects';
import {prettifyAggregation} from 'sentry/views/explore/utils';

// Types
type SeriesData = {
  data: Map<number, number>;
  name: string;
  rateUnit: RateUnit | null;
  unit: string | null;
};

type GridHelpers = {
  cols: number;
  grid: string[][];
  putText: (text: string, l: number, r: number, t: number, b: number) => void;
  rows: number;
  setCell: (r: number, c: number, ch: string) => void;
  writeOverlay: (r: number, c: number, text: string) => void;
};

type ChartProcessingContext = {
  cellHeightPx: number;
  cellWidthPx: number;
  gridHelpers: GridHelpers;
  isExcluded: (el: Element | null) => boolean;
  isVisible: (el: Element) => boolean;
  leftShiftPx: number;
  viewportHeight: number;
  viewportWidth: number;
};

/**
 * Creates grid helpers for ASCII rendering
 */
function createGridHelpers(rows: number, cols: number): GridHelpers {
  const grid: string[][] = Array.from({length: rows}, () =>
    Array.from({length: cols}, () => ' ')
  );

  const setCell = (r: number, c: number, ch: string) => {
    if (r < 0 || r >= grid.length) return;
    const row = grid[r];
    if (!row) return;
    if (c < 0) return;
    if (c >= row.length) {
      const toAdd = c - row.length + 1;
      for (let i = 0; i < toAdd; i++) row.push(' ');
    }
    if (row[c] === ' ') {
      row[c] = ch;
    }
  };

  const writeOverlay = (r: number, c: number, text: string) => {
    if (r < 0 || r >= grid.length) return;
    const row = grid[r];
    if (!row) return;
    if (c < 0) return;
    if (c + text.length >= row.length) {
      const toAdd = c + text.length - row.length + 1;
      for (let i = 0; i < toAdd; i++) row.push(' ');
    }
    for (let i = 0; i < text.length; i++) {
      row[c + i] = text.charAt(i);
    }
  };

  const putText = (text: string, l: number, r: number, t: number, b: number) => {
    if (t > b || l > r) return;
    const targetRow = Math.min(Math.max(Math.floor((t + b) / 2), 0), rows - 1);
    const clean = text.replace(/\s+/g, ' ').trim();
    const row = grid[targetRow];
    if (!row) return;
    const startCol = Math.max(0, l);
    for (let i = 0; i < clean.length; i++) {
      setCell(targetRow, startCol + i, clean.charAt(i));
    }
  };

  return {setCell, writeOverlay, putText, grid, rows, cols};
}

/**
 * Computes left shift to account for navigation bars
 */
function computeLeftShiftPx(viewportWidth: number): number {
  try {
    const navSelector =
      '[role="navigation"][aria-label="Primary Navigation"], [role="navigation"][aria-label="Secondary Navigation"], [data-test-id="collapsed-secondary-sidebar"]';
    const nodes = Array.from(document.querySelectorAll(navSelector));
    let shift = 0;
    for (const n of nodes) {
      const rect = n.getBoundingClientRect();
      const intersects = !(rect.right <= 0 || rect.left >= viewportWidth);
      if (intersects && rect.width > 0 && rect.height > 0) {
        if (rect.right > shift) shift = rect.right;
      }
    }
    return Math.max(0, Math.floor(shift));
  } catch (e) {
    return 0;
  }
}

/**
 * Checks if an element should be excluded from the snapshot
 */
function createIsExcluded(): (el: Element | null) => boolean {
  return (el: Element | null): boolean => {
    let node: Element | null = el;
    while (node) {
      if ((node as HTMLElement).dataset?.seerExplorerRoot !== undefined) {
        return true;
      }
      const nav = (node as HTMLElement).closest(
        '[role="navigation"][aria-label="Primary Navigation"], [role="navigation"][aria-label="Secondary Navigation"], [data-test-id="collapsed-secondary-sidebar"]'
      );
      if (nav) {
        return true;
      }
      node = node.parentElement;
    }
    return false;
  };
}

/**
 * Checks if an element is visible
 */
function createIsVisible(
  viewportWidth: number,
  viewportHeight: number
): (el: Element) => boolean {
  return (el: Element) => {
    const style = window.getComputedStyle(el);
    if (
      style.display === 'none' ||
      style.visibility === 'hidden' ||
      style.opacity === '0'
    ) {
      return false;
    }
    const rect = el.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) {
      return false;
    }
    if (
      rect.right <= 0 ||
      rect.bottom <= 0 ||
      rect.left >= viewportWidth ||
      rect.top >= viewportHeight
    ) {
      return false;
    }
    return true;
  };
}

/**
 * Extracts and formats series name with query details preserved
 */
function extractSeriesName(rawSeriesName: string): {
  parsedFunc: ReturnType<typeof parseFunction> | null;
  seriesName: string;
} {
  const rawSeriesNameStr = String(rawSeriesName);
  let parsedFunc = parseFunction(rawSeriesNameStr);
  let aggregationPart = rawSeriesNameStr;

  if (!parsedFunc && rawSeriesNameStr.includes(' ')) {
    aggregationPart = rawSeriesNameStr.split(' ')[0]!;
    parsedFunc = parseFunction(aggregationPart);
  }

  if (!parsedFunc && rawSeriesNameStr.includes(':')) {
    aggregationPart = rawSeriesNameStr.split(':')[0]!;
    parsedFunc = parseFunction(aggregationPart);
  }

  let seriesName: string;
  if (parsedFunc) {
    const prettifiedFunc = prettifyParsedFunction(parsedFunc);
    if (rawSeriesNameStr.startsWith(aggregationPart)) {
      const remainingContext = rawSeriesNameStr.slice(aggregationPart.length).trim();
      seriesName = remainingContext
        ? `${prettifiedFunc} ${remainingContext}`
        : prettifiedFunc;
    } else {
      seriesName = rawSeriesNameStr.replace(aggregationPart, prettifiedFunc);
    }
  } else {
    seriesName = prettifyAggregation(rawSeriesNameStr) || rawSeriesNameStr;
  }

  return {seriesName, parsedFunc};
}

/**
 * Determines unit information from parsed function
 */
function extractUnitInfo(
  parsedFunc: ReturnType<typeof parseFunction> | null,
  rawSeriesName: string,
  option: any
): {rateUnit: RateUnit | null; unit: string | null} {
  let unit: string | null = null;
  let rateUnit: RateUnit | null = null;

  if (!parsedFunc) {
    return {unit: null, rateUnit: null};
  }

  const outputType = aggregateFunctionOutputType(
    parsedFunc.name,
    parsedFunc.arguments[0]
  );

  // Handle rate functions (epm, eps)
  if (parsedFunc.name === 'epm' || rawSeriesName.toLowerCase().includes('epm()')) {
    rateUnit = RateUnit.PER_MINUTE;
  } else if (parsedFunc.name === 'eps' || rawSeriesName.toLowerCase().includes('eps()')) {
    rateUnit = RateUnit.PER_SECOND;
  } else if (outputType === 'duration') {
    const yAxis = option.yAxis;
    if (Array.isArray(yAxis) && yAxis.length > 0) {
      const axis = yAxis[0];
      if (axis && typeof axis === 'object' && 'unit' in axis) {
        unit = String(axis.unit);
      }
    } else if (yAxis && typeof yAxis === 'object' && 'unit' in yAxis) {
      unit = String(yAxis.unit);
    }
    if (!unit) {
      unit = 'millisecond';
    }
  } else if (outputType === 'size') {
    unit = 'byte';
  } else if (outputType === 'percentage') {
    unit = 'percent';
  } else if (outputType === 'rate') {
    if (!rateUnit) {
      rateUnit = RateUnit.PER_SECOND;
    }
  }

  return {unit, rateUnit};
}

/**
 * Extracts data points from ECharts series data
 */
function extractDataPoints(data: any[]): Map<number, number> {
  const dataMap = new Map<number, number>();

  data.forEach((item, index) => {
    let x: number | null = null;
    let y: number | null = null;

    if (Array.isArray(item)) {
      if (item.length >= 2 && Number.isFinite(item[0]) && Number.isFinite(item[1])) {
        x = Number(item[0]);
        y = Number(item[1]);
      }
    } else if (typeof item === 'number') {
      x = index;
      y = item;
    } else if (item && typeof item === 'object') {
      const name = (item as {name?: unknown}).name;
      const value = (item as {value?: unknown}).value;
      if (
        (typeof name === 'number' || typeof name === 'string') &&
        typeof value === 'number' &&
        Number.isFinite(value)
      ) {
        x = typeof name === 'number' ? name : Number(name);
        y = value;
      } else if (Array.isArray(value) && value.length >= 2) {
        if (Number.isFinite(value[0]) && Number.isFinite(value[1])) {
          x = Number(value[0]);
          y = Number(value[1]);
        }
      }
    }

    if (x !== null && y !== null && Number.isFinite(x) && Number.isFinite(y)) {
      dataMap.set(x, y);
    }
  });

  return dataMap;
}

/**
 * Formats a timestamp for display
 */
function formatTimestamp(ts: number, bucketSizeMs: number): string {
  if (ts > 1000000000000) {
    try {
      const startDate = new Date(ts);
      const startStr = startDate.toISOString().replace('T', ' ').substring(0, 16);

      if (bucketSizeMs > 0) {
        const endDate = new Date(ts + bucketSizeMs);
        const sameDay =
          startDate.toISOString().substring(0, 10) ===
          endDate.toISOString().substring(0, 10);

        if (sameDay) {
          const endTime = endDate.toISOString().substring(11, 16);
          return `${startStr}-${endTime}`;
        }
        const endStr = endDate.toISOString().replace('T', ' ').substring(0, 16);
        return `${startStr} - ${endStr}`;
      }
      return startStr;
    } catch (e) {
      return String(ts);
    }
  }
  return String(ts);
}

/**
 * Formats a value with appropriate unit
 */
function formatValue(
  value: number | undefined,
  unit: string | null,
  rateUnit: RateUnit | null
): string {
  if (value === undefined) {
    return '-';
  }
  if (rateUnit !== null && rateUnit !== undefined) {
    return formatRate(value, rateUnit);
  }
  if (unit) {
    return formatMetricUsingUnit(value, unit);
  }
  return formatAbbreviatedNumberWithDynamicPrecision(value);
}

/**
 * Builds a table from timeseries data
 */
function buildChartTable(
  seriesData: SeriesData[],
  timestamps: number[],
  formatTimestampFn: (ts: number) => string
): string {
  const columnNames = ['Time (UTC)', ...seriesData.map(s => s.name)];

  // Calculate column widths
  const columnWidths = columnNames.map((name, idx) => {
    let maxWidth = name.length;
    if (idx === 0) {
      for (const x of timestamps) {
        const tsStr = formatTimestampFn(x);
        maxWidth = Math.max(maxWidth, tsStr.length);
      }
    } else {
      const seriesIdx = idx - 1;
      const currentSeries = seriesData[seriesIdx];
      if (currentSeries) {
        for (const x of timestamps) {
          const y = currentSeries.data.get(x);
          const valStr = formatValue(y, currentSeries.unit, currentSeries.rateUnit);
          maxWidth = Math.max(maxWidth, valStr.length);
        }
      }
    }
    return maxWidth;
  });

  const padRight = (str: string, width: number): string => {
    return (str || '').padEnd(width, ' ');
  };

  // Build header row
  const headerRow = columnNames
    .map((name, idx) => padRight(name, columnWidths[idx] || 0))
    .join('  ');

  const tableRows: string[] = [headerRow];

  // Build data rows
  for (const x of timestamps) {
    const timestampStr = formatTimestampFn(x);
    const values = seriesData.map((s, idx) => {
      const y = s.data.get(x);
      const valStr = formatValue(y, s.unit, s.rateUnit);
      return padRight(valStr, columnWidths[idx + 1] || 0);
    });
    const row = `${padRight(timestampStr, columnWidths[0] || 0)}  ${values.join('  ')}`;
    tableRows.push(row);
  }

  return tableRows.join('\n');
}

/**
 * Processes ECharts instances and converts them to tables
 */
function processCharts(
  context: ChartProcessingContext,
  chartTables: string[]
): Set<Element> {
  const chartContainers = new Set<Element>();
  const {gridHelpers, viewportWidth, viewportHeight, cellHeightPx, leftShiftPx} = context;

  try {
    const selector = '[data-ec], [data-zr-dom-id], .echarts-for-react, .echarts';
    const candidates = Array.from(document.querySelectorAll(selector));

    const instanceByDom = new Map<Element, any>();
    for (const el of candidates) {
      if (context.isExcluded(el) || !context.isVisible(el)) continue;

      let container: Element | null = el;
      const nearest = el.closest('[data-ec], .echarts-for-react, .echarts');
      if (nearest) container = nearest;

      let inst: any = null;
      if (container) {
        inst = echarts.getInstanceByDom(container as HTMLDivElement);
      }
      if (!inst && el.parentElement) {
        inst = echarts.getInstanceByDom(el.parentElement as HTMLDivElement);
      }
      if (inst?.getDom && inst?.getOption) {
        const dom = inst.getDom();
        instanceByDom.set(dom, inst);
        chartContainers.add(dom);
      }
    }

    const TIMESERIES_TYPES = new Set(['line', 'bar', 'area', 'scatter']);

    // Count timeseries charts
    let timeseriesChartCount = 0;
    for (const [, inst] of instanceByDom) {
      const dom: Element = inst.getDom();
      if (context.isExcluded(dom) || !context.isVisible(dom)) continue;

      const rect = dom.getBoundingClientRect();
      if (
        rect.right <= 0 ||
        rect.bottom <= 0 ||
        rect.left >= viewportWidth ||
        rect.top >= viewportHeight
      ) {
        continue;
      }

      const option = inst.getOption?.() || {};
      const series: any[] = Array.isArray(option.series) ? option.series : [];
      if (!series.length) continue;

      let hasTimeseriesData = false;
      for (const s of series) {
        if (s?.show === false) continue;
        const type = String(s?.type || '').toLowerCase();
        if (TIMESERIES_TYPES.has(type)) {
          const data: any[] = Array.isArray(s?.data) ? s.data : [];
          if (data.length > 0) {
            hasTimeseriesData = true;
            break;
          }
        }
      }

      if (hasTimeseriesData) {
        timeseriesChartCount++;
      }
    }

    // Process charts and build tables
    let chartIndex = 0;
    for (const [, inst] of instanceByDom) {
      const dom: Element = inst.getDom();
      if (context.isExcluded(dom) || !context.isVisible(dom)) continue;

      const rect = dom.getBoundingClientRect();
      if (
        rect.right <= 0 ||
        rect.bottom <= 0 ||
        rect.left >= viewportWidth ||
        rect.top >= viewportHeight
      ) {
        continue;
      }

      const option = inst.getOption?.() || {};
      const series: any[] = Array.isArray(option.series) ? option.series : [];
      if (!series.length) continue;

      const timeseriesData: SeriesData[] = [];

      for (const s of series) {
        if (s?.show === false) continue;

        const type = String(s?.type || '').toLowerCase();
        if (!TIMESERIES_TYPES.has(type)) {
          try {
            const centerRow = Math.min(
              gridHelpers.rows - 1,
              Math.max(0, Math.floor((rect.top + rect.height / 2) / cellHeightPx))
            );
            const centerCol = Math.max(
              0,
              Math.floor((rect.left + rect.width / 2 - leftShiftPx) / context.cellWidthPx)
            );
            const label = `${type}[…]`;
            gridHelpers.writeOverlay(
              centerRow,
              centerCol - Math.floor(label.length / 2),
              label
            );
          } catch (e) {
            /* noop */
          }
          continue;
        }

        const data: any[] = Array.isArray(s?.data) ? s.data : [];
        if (!data.length) continue;

        const rawSeriesName =
          s?.name || s?.seriesName || `Series${timeseriesData.length + 1}`;
        const {seriesName, parsedFunc} = extractSeriesName(String(rawSeriesName));
        const {unit, rateUnit} = extractUnitInfo(
          parsedFunc,
          String(rawSeriesName),
          option
        );
        const dataMap = extractDataPoints(data);

        if (dataMap.size > 0) {
          timeseriesData.push({
            name: seriesName,
            data: dataMap,
            unit,
            rateUnit,
          });
        }
      }

      if (timeseriesData.length === 0) continue;

      const nonEmptySeries = timeseriesData.filter(s => s.data.size > 0);
      if (nonEmptySeries.length === 0) continue;

      const seenNames = new Set<string>();
      const uniqueSeries = nonEmptySeries.filter(s => {
        if (seenNames.has(s.name)) {
          return false;
        }
        seenNames.add(s.name);
        return true;
      });

      if (uniqueSeries.length === 0) continue;

      chartIndex++;
      const chartNumber = chartIndex;
      const totalCharts = timeseriesChartCount;

      const allXValues = new Set<number>();
      for (const seriesData of uniqueSeries) {
        for (const x of seriesData.data.keys()) {
          allXValues.add(x);
        }
      }

      const sortedXValues = Array.from(allXValues).sort((a, b) => a - b);

      const BUCKET_SIZES = [
        {ms: 60_000, label: '1min'},
        {ms: 300_000, label: '5min'},
        {ms: 1_800_000, label: '30min'},
        {ms: 3_600_000, label: '1hr'},
        {ms: 21_600_000, label: '6hr'},
        {ms: 43_200_000, label: '12hr'},
        {ms: 86_400_000, label: '1d'},
        {ms: 259_200_000, label: '3d'},
      ];
      const maxBuckets = 50;

      const minX = sortedXValues[0]!;
      const maxX = sortedXValues[sortedXValues.length - 1]!;
      const timeRange = maxX - minX;

      let chosenBucketSize = BUCKET_SIZES[BUCKET_SIZES.length - 1]!;
      for (const bucket of BUCKET_SIZES) {
        if (Math.ceil(timeRange / bucket.ms) <= maxBuckets) {
          chosenBucketSize = bucket;
          break;
        }
      }

      let displayTimestamps: number[];
      let displaySeriesData: SeriesData[];
      let bucketSizeMs: number;

      if (sortedXValues.length <= maxBuckets && timeRange < chosenBucketSize.ms) {
        displayTimestamps = sortedXValues;
        displaySeriesData = uniqueSeries;
        bucketSizeMs = 0;
      } else {
        bucketSizeMs = chosenBucketSize.ms;
        const alignedMinX = Math.floor(minX / bucketSizeMs) * bucketSizeMs;
        const numBuckets = Math.ceil((maxX - alignedMinX) / bucketSizeMs);

        displayTimestamps = [];
        for (let i = 0; i < numBuckets; i++) {
          displayTimestamps.push(alignedMinX + i * bucketSizeMs);
        }

        displaySeriesData = uniqueSeries.map(s => {
          const bucketedData = new Map<number, number>();

          for (const [x, y] of s.data) {
            const bucketIndex = Math.min(
              numBuckets - 1,
              Math.floor((x - alignedMinX) / bucketSizeMs)
            );
            const bucketTime = displayTimestamps[bucketIndex]!;
            const existing = bucketedData.get(bucketTime) ?? 0;
            bucketedData.set(bucketTime, existing + y);
          }

          return {
            data: bucketedData,
            name: s.name,
            rateUnit: s.rateUnit,
            unit: s.unit,
          };
        });
      }

      const formatTimestampFn = (ts: number) => formatTimestamp(ts, bucketSizeMs);

      const chartRow = Math.max(
        0,
        Math.min(
          gridHelpers.rows - 1,
          Math.floor((rect.top + rect.height / 2) / cellHeightPx)
        )
      );
      const chartCol = Math.max(
        0,
        Math.floor((rect.left + rect.width / 2 - leftShiftPx) / context.cellWidthPx)
      );
      const marker = `[CHART ${chartNumber}${totalCharts > 1 ? `/${totalCharts}` : ''} RENDERED HERE; SEE DATA IN FOOTNOTES]`;
      gridHelpers.writeOverlay(
        chartRow,
        chartCol - Math.floor(marker.length / 2),
        marker
      );

      const table = buildChartTable(
        displaySeriesData,
        displayTimestamps,
        formatTimestampFn
      );
      chartTables.push(table);
    }
  } catch (e) {
    /* noop: chart detection should not break snapshot */
  }

  return chartContainers;
}

/**
 * Renders text nodes to the grid
 */
function renderTextNodes(
  context: ChartProcessingContext,
  chartContainers: Set<Element>
): void {
  const {
    gridHelpers,
    viewportWidth,
    viewportHeight,
    cellWidthPx,
    cellHeightPx,
    leftShiftPx,
  } = context;

  const isWithinChart = (el: Element | null): boolean => {
    let node: Element | null = el;
    while (node) {
      if (chartContainers.has(node)) {
        return true;
      }
      node = node.parentElement;
    }
    return false;
  };

  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  let node: Node | null = walker.nextNode();

  while (node) {
    const textNode = node as Text;
    const parent = textNode.parentElement;
    const raw = (textNode.textContent || '').replace(/\s+/g, ' ').trim();

    if (parent && raw) {
      if (isWithinChart(parent)) {
        node = walker.nextNode();
        continue;
      }

      if (!context.isExcluded(parent) && context.isVisible(parent)) {
        const range = document.createRange();
        range.selectNodeContents(textNode);
        const rects = Array.from(range.getClientRects());

        if (rects.length > 0) {
          const style = window.getComputedStyle(parent);
          const whiteSpace = style.whiteSpace || '';
          const noWrap = /nowrap|pre/.test(whiteSpace);
          const hasEllipsis = (style.textOverflow || '').includes('ellipsis');
          const webkitLineClamp =
            (style as any).webkitLineClamp ||
            style.getPropertyValue?.('-webkit-line-clamp');
          const lineClampActive =
            typeof webkitLineClamp === 'string' &&
            webkitLineClamp !== '' &&
            webkitLineClamp !== 'none' &&
            Number.isFinite(Number(webkitLineClamp)) &&
            Number(webkitLineClamp) > 0;
          const singleLineEllipsize = rects.length === 1 && noWrap && hasEllipsis;
          const textAlign = (style.textAlign || 'left').toLowerCase();
          const clipRect = parent.getBoundingClientRect();
          const ELLIPSIS_CHAR = '…';

          const renderRect = (rect: DOMRect, remaining: string, isLast: boolean) => {
            if (
              rect.right <= 0 ||
              rect.bottom <= 0 ||
              rect.left >= viewportWidth ||
              rect.top >= viewportHeight
            ) {
              return remaining;
            }

            const effLeftPx = Math.max(rect.left, clipRect.left);
            const effRightPx = Math.min(rect.right, clipRect.right);
            if (effRightPx <= effLeftPx) return remaining;

            const left = Math.max(0, Math.floor((effLeftPx - leftShiftPx) / cellWidthPx));
            const right = Math.floor((effRightPx - leftShiftPx - 1) / cellWidthPx);
            const top = Math.max(0, Math.floor(rect.top / cellHeightPx));
            const bottom = Math.min(
              gridHelpers.rows - 1,
              Math.floor((rect.bottom - 1) / cellHeightPx)
            );

            if (right <= left || bottom < top) return remaining;

            const capacity = Math.max(1, right - left + 1);
            let segment = remaining.slice(0, capacity);

            if (
              isLast &&
              remaining.length > capacity &&
              (singleLineEllipsize || lineClampActive)
            ) {
              if (capacity >= 1) {
                segment = segment.slice(0, Math.max(0, capacity - 1)) + ELLIPSIS_CHAR;
              }
            }

            let alignedLeft = left;
            if (textAlign === 'right' || textAlign === 'end') {
              alignedLeft = Math.max(left, right - segment.length + 1);
            } else if (textAlign === 'center') {
              const pad = Math.max(0, Math.floor((capacity - segment.length) / 2));
              alignedLeft = left + pad;
            }

            const alignedRight = Math.max(alignedLeft, alignedLeft + segment.length - 1);

            gridHelpers.putText(segment, alignedLeft, alignedRight, top, bottom);

            return remaining.slice(Math.min(remaining.length, capacity));
          };

          if (singleLineEllipsize) {
            for (const rect of rects) {
              const remaining = renderRect(rect, raw, true);
              if (!remaining || remaining === raw) break;
            }
          } else if (lineClampActive) {
            let remaining = raw;
            for (let idx = 0; idx < rects.length; idx++) {
              const isLast = idx === rects.length - 1;
              remaining = renderRect(rects[idx]!, remaining, isLast);
              if (!remaining) break;
            }
          } else {
            let remaining = raw;
            for (const rect of rects) {
              remaining = renderRect(rect, remaining, false);
              if (!remaining) break;
            }
          }
        }
      }
    }

    node = walker.nextNode();
  }
}

/**
 * Builds the final result string with footnotes
 */
function buildResult(
  gridHelpers: GridHelpers,
  chartTables: string[],
  projectSlugs: string[]
): string {
  const url = window.location.href;
  let result = url + '\n' + gridHelpers.grid.map(row => row.join('')).join('\n');

  if (chartTables.length > 0 || projectSlugs.length > 0) {
    result += '\n\n=== FOOTNOTES ===\n\n';

    if (projectSlugs.length > 0) {
      result += `This page has the following projects selected: ${projectSlugs.join(', ')}\n`;
      if (chartTables.length > 0) {
        result += '\n';
      }
    }

    if (chartTables.length > 0) {
      chartTables.forEach((table, index) => {
        result += `Chart ${index + 1}:\n${table}\n\n`;
      });
    }
  }

  return result;
}

/**
 * Captures a coarse ASCII representation of the current page by laying out
 * visible elements onto a character grid based on their bounding rectangles.
 * Elements within any ancestor marked with `data-seer-explorer-root` are excluded.
 */
function useAsciiSnapshot() {
  const {selection} = usePageFilters();
  const {projects} = useProjects();

  const capture = useCallback(() => {
    if (typeof document === 'undefined' || typeof window === 'undefined') {
      return '';
    }

    const viewportWidth = Math.max(0, Math.floor(window.innerWidth));
    const viewportHeight = Math.max(0, Math.floor(window.innerHeight));

    const cellWidthPx = 6;
    const cellHeightPx = 14;

    const cols = Math.max(1, Math.floor(viewportWidth / cellWidthPx));
    const rows = Math.max(1, Math.floor(viewportHeight / cellHeightPx));

    const leftShiftPx = computeLeftShiftPx(viewportWidth);
    const gridHelpers = createGridHelpers(rows, cols);
    const isExcluded = createIsExcluded();
    const isVisible = createIsVisible(viewportWidth, viewportHeight);

    const context: ChartProcessingContext = {
      gridHelpers,
      viewportWidth,
      viewportHeight,
      cellWidthPx,
      cellHeightPx,
      leftShiftPx,
      isExcluded,
      isVisible,
    };

    const chartTables: string[] = [];
    const chartContainers = processCharts(context, chartTables);
    renderTextNodes(context, chartContainers);

    const projectSlugs: string[] = [];
    const projectSelector = document.querySelector(
      '[data-test-id="page-filter-project-selector"]'
    );
    if (projectSelector && selection.projects.length > 0) {
      const projectIdToSlug = new Map(projects.map(p => [parseInt(p.id, 10), p.slug]));
      for (const projectId of selection.projects) {
        const slug = projectIdToSlug.get(projectId);
        if (slug) {
          projectSlugs.push(slug);
        }
      }
    }

    return buildResult(gridHelpers, chartTables, projectSlugs);
  }, [selection.projects, projects]);

  return capture;
}

export default useAsciiSnapshot;
