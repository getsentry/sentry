import {useCallback} from 'react';
import * as echarts from 'echarts/core';

import {formatAbbreviatedNumberWithDynamicPrecision} from 'sentry/utils/formatters';
import usePageFilters from 'sentry/utils/usePageFilters';
import useProjects from 'sentry/utils/useProjects';
import {prettifyAggregation} from 'sentry/views/explore/utils';

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

    // Character cell size approximating a monospace font cell
    // Slightly smaller cells increase resolution to reduce truncation
    const cellWidthPx = 6; // average monospace character width
    const cellHeightPx = 14; // average monospace line height

    const cols = Math.max(1, Math.floor(viewportWidth / cellWidthPx));
    const rows = Math.max(1, Math.floor(viewportHeight / cellHeightPx));

    const grid: string[][] = Array.from({length: rows}, () =>
      Array.from({length: cols}, () => ' ')
    );

    // Compute aggregate left shift equal to visible left nav widths so content is left-aligned
    const computeLeftShiftPx = (): number => {
      try {
        const navSelector =
          '[role="navigation"][aria-label="Primary Navigation"], [role="navigation"][aria-label="Secondary Navigation"], [data-test-id="collapsed-secondary-sidebar"]';
        const nodes = Array.from(document.querySelectorAll(navSelector));
        let shift = 0;
        for (const n of nodes) {
          const rect = n.getBoundingClientRect();
          // Consider only elements that intersect the viewport and have width
          const intersects = !(rect.right <= 0 || rect.left >= viewportWidth);
          if (intersects && rect.width > 0 && rect.height > 0) {
            if (rect.right > shift) shift = rect.right;
          }
        }
        return Math.max(0, Math.floor(shift));
      } catch (e) {
        return 0;
      }
    };
    const leftShiftPx = computeLeftShiftPx();

    const isExcluded = (el: Element | null): boolean => {
      let node: Element | null = el;
      while (node) {
        if ((node as HTMLElement).dataset?.seerExplorerRoot !== undefined) {
          return true;
        }
        // Exclude Sentry left navigation (primary) and left sub navigation (secondary)
        // Matches wrappers rendered in `views/nav/sidebar.tsx` and `views/nav/secondary/secondary.tsx`
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

    const isVisible = (el: Element) => {
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
      // Must intersect the viewport
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

    const setCell = (r: number, c: number, ch: string) => {
      if (r < 0 || r >= grid.length) return;
      const row = grid[r];
      if (!row) return;
      if (c < 0) return;
      // Expand the row width as needed so long labels aren't squished
      if (c >= row.length) {
        const toAdd = c - row.length + 1;
        for (let i = 0; i < toAdd; i++) row.push(' ');
      }
      if (row[c] === ' ') {
        row[c] = ch;
      }
    };

    // Force-write overlay text at row/col, expanding width as needed
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

    // Intentionally removed detailed debug metadata to avoid unused variable warnings

    // Collect chart tables to append as footnotes
    const chartTables: string[] = [];
    // Track chart containers to exclude their text content (axes, labels, etc.)
    const chartContainers = new Set<Element>();

    // ----- Chart to table conversion (for timeseries charts) -----
    try {
      // Collect potential ECharts containers
      const selector = '[data-ec], [data-zr-dom-id], .echarts-for-react, .echarts';
      const candidates = Array.from(document.querySelectorAll(selector));

      // Map unique instances by their DOM element
      const instanceByDom = new Map<Element, any>();
      for (const el of candidates) {
        if (isExcluded(el) || !isVisible(el)) continue;

        let container: Element | null = el;
        // Prefer the closest known container
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
          // Track chart container for exclusion
          chartContainers.add(dom);
        }
      }

      // Timeseries chart types that can be converted to tables
      const TIMESERIES_TYPES = new Set(['line', 'bar', 'area', 'scatter']);

      // First pass: count charts with timeseries data
      let timeseriesChartCount = 0;
      for (const [, inst] of instanceByDom) {
        const dom: Element = inst.getDom();
        if (isExcluded(dom) || !isVisible(dom)) continue;

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

        // Check if this chart has timeseries data
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

      // Second pass: process charts and build tables
      let chartIndex = 0;
      for (const [, inst] of instanceByDom) {
        const dom: Element = inst.getDom();
        if (isExcluded(dom) || !isVisible(dom)) continue;

        const rect = dom.getBoundingClientRect();
        // Skip if outside viewport
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

        // Extract timeseries data from all series
        const timeseriesData: Array<{
          data: Map<number, number>; // x -> y mapping
          name: string;
        }> = [];

        for (const s of series) {
          if (s?.show === false) continue;

          const type = String(s?.type || '').toLowerCase();
          if (!TIMESERIES_TYPES.has(type)) {
            // For non-timeseries charts, show a simple label
            try {
              const centerRow = Math.min(
                rows - 1,
                Math.max(0, Math.floor((rect.top + rect.height / 2) / cellHeightPx))
              );
              const centerCol = Math.max(
                0,
                Math.floor((rect.left + rect.width / 2 - leftShiftPx) / cellWidthPx)
              );
              const label = `${type}[…]`;
              writeOverlay(centerRow, centerCol - Math.floor(label.length / 2), label);
            } catch (e) {
              /* noop: overlay fallback */
            }
            continue;
          }

          const data: any[] = Array.isArray(s?.data) ? s.data : [];
          if (!data.length) continue;

          // Try to get a prettier name for the series
          const rawSeriesName =
            s?.name || s?.seriesName || `Series${timeseriesData.length + 1}`;
          const seriesName = prettifyAggregation(String(rawSeriesName)) || rawSeriesName;
          const dataMap = new Map<number, number>();

          // Extract x,y pairs from various data formats
          data.forEach((item, index) => {
            let x: number | null = null;
            let y: number | null = null;

            if (Array.isArray(item)) {
              // Format: [x, y] or [timestamp, value]
              if (
                item.length >= 2 &&
                Number.isFinite(item[0]) &&
                Number.isFinite(item[1])
              ) {
                x = Number(item[0]);
                y = Number(item[1]);
              }
            } else if (typeof item === 'number') {
              // Format: single number (y-value, use index as x)
              x = index;
              y = item;
            } else if (item && typeof item === 'object') {
              // Format: {name: timestamp, value: number}
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
                // Format: {value: [x, y]}
                if (Number.isFinite(value[0]) && Number.isFinite(value[1])) {
                  x = Number(value[0]);
                  y = Number(value[1]);
                }
              }
            }

            if (x !== null && y !== null && Number.isFinite(x) && Number.isFinite(y)) {
              // If multiple points share the same x, take the last one
              dataMap.set(x, y);
            }
          });

          if (dataMap.size > 0) {
            timeseriesData.push({name: String(seriesName), data: dataMap});
          }
        }

        // If we have timeseries data, convert to table
        if (timeseriesData.length > 0) {
          // Filter out empty series (series with no data points)
          const nonEmptySeries = timeseriesData.filter(s => s.data.size > 0);
          if (nonEmptySeries.length === 0) continue;

          // Deduplicate series by name (keep the first one with data)
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

          // Collect all unique x-values (timestamps) across all series
          const allXValues = new Set<number>();
          for (const seriesData of uniqueSeries) {
            for (const x of seriesData.data.keys()) {
              allXValues.add(x);
            }
          }

          // Sort x-values
          const sortedXValues = Array.from(allXValues).sort((a, b) => a - b);

          // Predefined bucket sizes (in milliseconds) for deterministic bucketing
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

          // Find the smallest bucket size that keeps us under maxBuckets
          let chosenBucketSize = BUCKET_SIZES[BUCKET_SIZES.length - 1]!;
          for (const bucket of BUCKET_SIZES) {
            if (Math.ceil(timeRange / bucket.ms) <= maxBuckets) {
              chosenBucketSize = bucket;
              break;
            }
          }

          let displayTimestamps: number[];
          let displaySeriesData: Array<{data: Map<number, number>; name: string}>;
          let bucketSizeMs: number;

          if (sortedXValues.length <= maxBuckets && timeRange < chosenBucketSize.ms) {
            // No bucketing needed - use original data
            displayTimestamps = sortedXValues;
            displaySeriesData = uniqueSeries;
            bucketSizeMs = 0; // Indicates no bucketing
          } else {
            bucketSizeMs = chosenBucketSize.ms;

            // Align bucket start to round intervals (e.g., start of minute/hour)
            const alignedMinX = Math.floor(minX / bucketSizeMs) * bucketSizeMs;
            const numBuckets = Math.ceil((maxX - alignedMinX) / bucketSizeMs);

            // Generate bucket start timestamps
            displayTimestamps = [];
            for (let i = 0; i < numBuckets; i++) {
              displayTimestamps.push(alignedMinX + i * bucketSizeMs);
            }

            // Sum each series' values into buckets
            displaySeriesData = uniqueSeries.map(s => {
              const bucketedData = new Map<number, number>();

              for (const [x, y] of s.data) {
                // Find which bucket this timestamp belongs to
                const bucketIndex = Math.min(
                  numBuckets - 1,
                  Math.floor((x - alignedMinX) / bucketSizeMs)
                );
                const bucketTime = displayTimestamps[bucketIndex]!;

                // Sum into the bucket
                const existing = bucketedData.get(bucketTime) ?? 0;
                bucketedData.set(bucketTime, existing + y);
              }

              return {data: bucketedData, name: s.name};
            });
          }

          // Format timestamp or time range for display (no seconds since intervals are round)
          const formatTimestamp = (ts: number): string => {
            if (ts > 1000000000000) {
              try {
                const startDate = new Date(ts);
                const startStr = startDate
                  .toISOString()
                  .replace('T', ' ')
                  .substring(0, 16); // "YYYY-MM-DD HH:MM"

                if (bucketSizeMs > 0) {
                  // Show time range for bucketed data
                  const endDate = new Date(ts + bucketSizeMs);
                  const sameDay =
                    startDate.toISOString().substring(0, 10) ===
                    endDate.toISOString().substring(0, 10);

                  if (sameDay) {
                    // Same day: "YYYY-MM-DD HH:MM-HH:MM"
                    const endTime = endDate.toISOString().substring(11, 16);
                    return `${startStr}-${endTime}`;
                  }
                  // Different day: "YYYY-MM-DD HH:MM - YYYY-MM-DD HH:MM"
                  const endStr = endDate.toISOString().replace('T', ' ').substring(0, 16);
                  return `${startStr} - ${endStr}`;
                }
                return startStr;
              } catch (e) {
                return String(ts);
              }
            }
            return String(ts);
          };

          // Mark chart location with numbered placeholder
          const chartRow = Math.max(
            0,
            Math.min(rows - 1, Math.floor((rect.top + rect.height / 2) / cellHeightPx))
          );
          const chartCol = Math.max(
            0,
            Math.floor((rect.left + rect.width / 2 - leftShiftPx) / cellWidthPx)
          );
          const marker = `[CHART ${chartNumber}${totalCharts > 1 ? `/${totalCharts}` : ''} RENDERED HERE; SEE DATA IN FOOTNOTES]`;
          writeOverlay(chartRow, chartCol - Math.floor(marker.length / 2), marker);

          // Build table with fixed-width columns (pandas-style, no separators)
          const columnNames = ['Time (UTC)', ...displaySeriesData.map(s => s.name)];

          // Calculate max width for each column
          const columnWidths = columnNames.map((name, idx) => {
            let maxWidth = name.length;
            if (idx === 0) {
              // Time column: check all timestamps
              for (const x of displayTimestamps) {
                const tsStr = formatTimestamp(x);
                maxWidth = Math.max(maxWidth, tsStr.length);
              }
            } else {
              // Data columns: check all values
              const seriesIdx = idx - 1;
              for (const x of displayTimestamps) {
                const y = displaySeriesData[seriesIdx]?.data.get(x);
                if (y === undefined) {
                  maxWidth = Math.max(maxWidth, 1); // '-' is 1 char
                } else {
                  const valStr = formatAbbreviatedNumberWithDynamicPrecision(y);
                  maxWidth = Math.max(maxWidth, valStr.length);
                }
              }
            }
            return maxWidth;
          });

          // Helper to pad string to fixed width
          const padRight = (str: string, width: number): string => {
            return (str || '').padEnd(width, ' ');
          };

          // Build header row
          const headerRow = columnNames
            .map((name, idx) => padRight(name, columnWidths[idx] || 0))
            .join('  '); // Two spaces between columns

          const tableRows: string[] = [headerRow];

          // Build data rows
          for (const x of displayTimestamps) {
            const timestampStr = formatTimestamp(x);
            const values = displaySeriesData.map((s, idx) => {
              const y = s.data.get(x);
              const valStr =
                y === undefined ? '-' : formatAbbreviatedNumberWithDynamicPrecision(y);
              return padRight(valStr, columnWidths[idx + 1] || 0);
            });
            const row = `${padRight(timestampStr, columnWidths[0] || 0)}  ${values.join('  ')}`;
            tableRows.push(row);
          }

          chartTables.push(tableRows.join('\n'));
        }
      }
    } catch (e) {
      /* noop: chart detection should not break snapshot */
    }

    // Helper to check if element is within a chart container
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

    // Text-node based placement for better accuracy and wrapping
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    let node: Node | null = walker.nextNode();
    while (node) {
      const textNode = node as Text;
      const parent = textNode.parentElement;
      const raw = (textNode.textContent || '').replace(/\s+/g, ' ').trim();
      if (parent && raw) {
        // Skip text within chart containers (axes, labels, etc.)
        if (isWithinChart(parent)) {
          node = walker.nextNode();
          continue;
        }
        if (!isExcluded(parent) && isVisible(parent)) {
          const range = document.createRange();
          range.selectNodeContents(textNode);
          const rects = Array.from(range.getClientRects());
          if (rects.length > 0) {
            const style = window.getComputedStyle(parent);
            const whiteSpace = style.whiteSpace || '';
            const noWrap = /nowrap|pre/.test(whiteSpace);
            const hasEllipsis = (style.textOverflow || '').includes('ellipsis');
            // Detect multi-line clamp via vendor property when possible
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

            if (singleLineEllipsize) {
              // Treat as a single visible line; respect clipping and add ellipsis if truncated
              for (const rect of rects) {
                if (
                  rect.right <= 0 ||
                  rect.bottom <= 0 ||
                  rect.left >= viewportWidth ||
                  rect.top >= viewportHeight
                ) {
                  continue;
                }
                const effLeftPx = Math.max(rect.left, clipRect.left);
                const effRightPx = Math.min(rect.right, clipRect.right);
                if (effRightPx <= effLeftPx) continue;
                const left = Math.max(
                  0,
                  Math.floor((effLeftPx - leftShiftPx) / cellWidthPx)
                );
                const right = Math.floor((effRightPx - leftShiftPx - 1) / cellWidthPx);
                const top = Math.max(0, Math.floor(rect.top / cellHeightPx));
                const bottom = Math.min(
                  rows - 1,
                  Math.floor((rect.bottom - 1) / cellHeightPx)
                );
                if (right <= left || bottom < top) continue;
                const capacity = Math.max(1, right - left + 1);
                let segment = raw;
                if (segment.length > capacity) {
                  segment = segment.slice(0, Math.max(0, capacity - 1)) + ELLIPSIS_CHAR;
                }
                let alignedLeft = left;
                if (textAlign === 'right' || textAlign === 'end') {
                  alignedLeft = Math.max(left, right - segment.length + 1);
                } else if (textAlign === 'center') {
                  const pad = Math.max(0, Math.floor((capacity - segment.length) / 2));
                  alignedLeft = left + pad;
                }
                const alignedRight = Math.max(
                  alignedLeft,
                  alignedLeft + segment.length - 1
                );
                putText(segment, alignedLeft, alignedRight, top, bottom);
                break;
              }
            } else if (lineClampActive) {
              // Multi-line clamp: render visible lines; ellipsize only the last visible line if truncated
              let remaining = raw;
              for (let idx = 0; idx < rects.length; idx++) {
                const rect = rects[idx]!;
                if (
                  rect.right <= 0 ||
                  rect.bottom <= 0 ||
                  rect.left >= viewportWidth ||
                  rect.top >= viewportHeight
                ) {
                  continue;
                }
                const effLeftPx = Math.max(rect.left, clipRect.left);
                const effRightPx = Math.min(rect.right, clipRect.right);
                if (effRightPx <= effLeftPx) continue;
                const left = Math.max(
                  0,
                  Math.floor((effLeftPx - leftShiftPx) / cellWidthPx)
                );
                const right = Math.floor((effRightPx - leftShiftPx - 1) / cellWidthPx);
                const top = Math.max(0, Math.floor(rect.top / cellHeightPx));
                const bottom = Math.min(
                  rows - 1,
                  Math.floor((rect.bottom - 1) / cellHeightPx)
                );
                if (right <= left || bottom < top) continue;
                const capacity = Math.max(1, right - left + 1);
                let segment = remaining.slice(0, capacity);
                if (idx === rects.length - 1 && remaining.length > capacity) {
                  // Ellipsize only the last visible line when text exceeds capacity
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
                const alignedRight = Math.max(
                  alignedLeft,
                  alignedLeft + segment.length - 1
                );
                putText(segment, alignedLeft, alignedRight, top, bottom);
                remaining = remaining.slice(Math.min(remaining.length, capacity));
                if (!remaining) break;
              }
            } else {
              // Wrapped text without clamp: write exactly what fits per rect; no ellipsis
              let remaining = raw;
              for (const rect of rects) {
                if (
                  rect.right <= 0 ||
                  rect.bottom <= 0 ||
                  rect.left >= viewportWidth ||
                  rect.top >= viewportHeight
                ) {
                  continue;
                }
                const effLeftPx = Math.max(rect.left, clipRect.left);
                const effRightPx = Math.min(rect.right, clipRect.right);
                if (effRightPx <= effLeftPx) continue;
                const left = Math.max(
                  0,
                  Math.floor((effLeftPx - leftShiftPx) / cellWidthPx)
                );
                const right = Math.floor((effRightPx - leftShiftPx - 1) / cellWidthPx);
                const top = Math.max(0, Math.floor(rect.top / cellHeightPx));
                const bottom = Math.min(
                  rows - 1,
                  Math.floor((rect.bottom - 1) / cellHeightPx)
                );
                if (right <= left || bottom < top) continue;
                const capacity = Math.max(1, right - left + 1);
                const segment = remaining.slice(0, capacity);
                let alignedLeft = left;
                if (textAlign === 'right' || textAlign === 'end') {
                  alignedLeft = Math.max(left, right - segment.length + 1);
                } else if (textAlign === 'center') {
                  const pad = Math.max(0, Math.floor((capacity - segment.length) / 2));
                  alignedLeft = left + pad;
                }
                const alignedRight = Math.max(
                  alignedLeft,
                  alignedLeft + segment.length - 1
                );
                putText(segment, alignedLeft, alignedRight, top, bottom);
                remaining = remaining.slice(segment.length);
                if (!remaining) break;
              }
            }
          }
        }
      }
      node = walker.nextNode();
    }

    // Top line: full URL of the current page
    const url = window.location.href;
    let result = url + '\n' + grid.map(row => row.join('')).join('\n');

    // Check if project selector exists on the page and get selected project slugs
    const projectSlugs: string[] = [];
    const projectSelector = document.querySelector(
      '[data-test-id="page-filter-project-selector"]'
    );
    if (projectSelector && selection.projects.length > 0) {
      // Convert project IDs to slugs
      const projectIdToSlug = new Map(projects.map(p => [parseInt(p.id, 10), p.slug]));
      for (const projectId of selection.projects) {
        const slug = projectIdToSlug.get(projectId);
        if (slug) {
          projectSlugs.push(slug);
        }
      }
    }

    // Append footnotes if either charts or projects are present
    if (chartTables.length > 0 || projectSlugs.length > 0) {
      result += '\n\n=== FOOTNOTES ===\n\n';

      // Append selected project slugs if project selector exists
      if (projectSlugs.length > 0) {
        result += `This page has the following projects selected: ${projectSlugs.join(', ')}\n`;
        if (chartTables.length > 0) {
          result += '\n';
        }
      }

      // Append chart tables
      if (chartTables.length > 0) {
        chartTables.forEach((table, index) => {
          result += `Chart ${index + 1}:\n${table}\n\n`;
        });
      }
    }

    return result;
  }, [selection.projects, projects]);

  return capture;
}

export default useAsciiSnapshot;
