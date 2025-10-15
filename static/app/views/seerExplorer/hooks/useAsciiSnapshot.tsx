import {useCallback, useEffect, useRef} from 'react';
import * as echarts from 'echarts/core';

/**
 * Captures a coarse ASCII representation of the current page by laying out
 * visible elements onto a character grid based on their bounding rectangles.
 * Elements within any ancestor marked with `data-seer-explorer-root` are excluded.
 */
function useAsciiSnapshot() {
  const mousePosRef = useRef<{inWindow: boolean; x: number; y: number} | null>(null);

  useEffect(() => {
    const handleMove = (e: MouseEvent) => {
      mousePosRef.current = {x: e.clientX, y: e.clientY, inWindow: true};
    };
    const handleLeave = () => {
      if (mousePosRef.current) {
        mousePosRef.current.inWindow = false;
      } else {
        mousePosRef.current = {x: 0, y: 0, inWindow: false};
      }
    };
    window.addEventListener('mousemove', handleMove, {passive: true});
    window.addEventListener('mouseleave', handleLeave, {passive: true});
    return () => {
      window.removeEventListener('mousemove', handleMove as EventListener);
      window.removeEventListener('mouseleave', handleLeave as EventListener);
    };
  }, []);

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

    // ----- Chart plotting (draw first so text can overlay labels) -----
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
          instanceByDom.set(inst.getDom(), inst);
        }
      }

      const MAX_POINTS_TOTAL = 5000;
      let pointsDrawn = 0;

      const drawPoint = (absX: number, absY: number) => {
        if (absX <= 0 || absY <= 0 || absX >= viewportWidth || absY >= viewportHeight) {
          return;
        }
        const rowIdx = Math.min(rows - 1, Math.max(0, Math.floor(absY / cellHeightPx)));
        const colIdx = Math.max(0, Math.floor((absX - leftShiftPx) / cellWidthPx));
        setCell(rowIdx, colIdx, '*');
      };

      const tryConvertToPixel = (
        inst: any,
        seriesIndex: number,
        xy: [number, number]
      ): [number, number] | null => {
        try {
          const p = inst.convertToPixel({seriesIndex}, xy);
          if (
            Array.isArray(p) &&
            p.length === 2 &&
            Number.isFinite(p[0]) &&
            Number.isFinite(p[1])
          ) {
            return [p[0], p[1]];
          }
        } catch (e) {
          /* noop: convertToPixel may throw for some series/coords */
        }
        try {
          const p = inst.convertToPixel('grid', xy as any);
          if (
            Array.isArray(p) &&
            p.length === 2 &&
            Number.isFinite(p[0]) &&
            Number.isFinite(p[1])
          ) {
            return [p[0], p[1]];
          }
        } catch (e) {
          /* noop: grid conversion unsupported in some configs */
        }
        return null;
      };

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

        const chartCols = Math.max(1, Math.floor(rect.width / cellWidthPx));
        const maxSeriesToPlot = 3; // cap for performance
        let plottedSeries = 0;

        for (let sIdx = 0; sIdx < series.length; sIdx++) {
          if (plottedSeries >= maxSeriesToPlot) break;
          const s = series[sIdx] || {};
          if (s?.show === false) continue;

          const type = String(s?.type || '').toLowerCase();
          if (type === 'pie' || type === 'treemap' || type === 'sunburst') {
            // Fallback textual summary centered in chart
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
            plottedSeries++;
            continue;
          }

          const data: any[] = Array.isArray(s?.data) ? s.data : [];
          if (!data.length) continue;

          const maxPointsForSeries = Math.max(1, chartCols);
          const stride = Math.max(1, Math.ceil(data.length / maxPointsForSeries));

          // Pre-sample for min/max and values
          const sampled: Array<{i: number; x: number; y: number}> = [];
          let minY = Number.POSITIVE_INFINITY;
          let maxY = Number.NEGATIVE_INFINITY;
          for (let i = 0; i < data.length; i += stride) {
            const item = data[i];
            let x: number | null = null;
            let y: number | null = null;

            if (Array.isArray(item)) {
              if (
                item.length >= 2 &&
                Number.isFinite(item[0]) &&
                Number.isFinite(item[1])
              ) {
                x = Number(item[0]);
                y = Number(item[1]);
              }
            } else if (typeof item === 'number') {
              x = i;
              y = item;
            } else if (item && typeof item === 'object') {
              const v = (item as {value?: unknown}).value;
              if (Array.isArray(v) && v.length >= 2) {
                if (Number.isFinite(v[0]) && Number.isFinite(v[1])) {
                  x = Number(v[0]);
                  y = Number(v[1]);
                }
              } else if (typeof v === 'number') {
                x = i;
                y = v;
              }
            }

            if (x === null || y === null || !Number.isFinite(x) || !Number.isFinite(y)) {
              continue;
            }

            sampled.push({x, y, i});
            if (y < minY) minY = y;
            if (y > maxY) maxY = y;
          }

          if (!sampled.length) continue;

          for (let k = 0; k < sampled.length; k++) {
            if (pointsDrawn >= MAX_POINTS_TOTAL) break;
            const pt = sampled[k];
            if (!pt) continue;

            // Try native conversion first
            const rel = tryConvertToPixel(inst, sIdx, [pt.x, pt.y]);
            if (rel) {
              const absX = rect.left + rel[0];
              const absY = rect.top + rel[1];
              drawPoint(absX, absY);
              pointsDrawn++;
              continue;
            }

            // Fallback: linear mapping within this chart rect
            if (!(Number.isFinite(minY) && Number.isFinite(maxY) && maxY > minY)) {
              continue;
            }
            const xRatio = sampled.length > 1 ? k / (sampled.length - 1) : 0;
            const yRatio = (pt.y - minY) / (maxY - minY);
            const absX = rect.left + xRatio * rect.width;
            const absY = rect.bottom - yRatio * rect.height;
            drawPoint(absX, absY);
            pointsDrawn++;
          }

          plottedSeries++;
          if (pointsDrawn >= MAX_POINTS_TOTAL) break;
        }

        if (pointsDrawn >= MAX_POINTS_TOTAL) break;
      }

      // (debug metadata omitted in favor of logging full snapshot)
    } catch (e) {
      /* noop: chart detection should not break snapshot */
    }

    // Text-node based placement for better accuracy and wrapping
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    let node: Node | null = walker.nextNode();
    while (node) {
      const textNode = node as Text;
      const parent = textNode.parentElement;
      const raw = (textNode.textContent || '').replace(/\s+/g, ' ').trim();
      if (parent && raw) {
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

    // Overlay the user's mouse cursor marker if within the viewport
    const cursorLabel = '[USER CURSOR]';
    const pos = mousePosRef.current;
    if (pos?.inWindow) {
      const within = !(
        pos.x <= 0 ||
        pos.y <= 0 ||
        pos.x >= viewportWidth ||
        pos.y >= viewportHeight
      );
      if (within) {
        const rowIdx = Math.min(rows - 1, Math.max(0, Math.floor(pos.y / cellHeightPx)));
        const colIdx = Math.max(0, Math.floor((pos.x - leftShiftPx) / cellWidthPx));
        writeOverlay(rowIdx, colIdx, cursorLabel);
      }
    }

    // Top line: full URL of the current page
    const url = window.location.href;
    const result = url + '\n' + grid.map(row => row.join('')).join('\n');
    return result;
  }, []);

  return capture;
}

export default useAsciiSnapshot;
