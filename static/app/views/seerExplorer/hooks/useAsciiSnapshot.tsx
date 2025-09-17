import {useCallback, useEffect, useRef} from 'react';

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

    const isExcluded = (el: Element | null): boolean => {
      let node: Element | null = el;
      while (node) {
        if ((node as HTMLElement).dataset?.seerExplorerRoot !== undefined) {
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
              const left = Math.max(0, Math.floor(rect.left / cellWidthPx));
              const right = Math.floor((rect.right - 1) / cellWidthPx);
              const top = Math.max(0, Math.floor(rect.top / cellHeightPx));
              const bottom = Math.min(
                rows - 1,
                Math.floor((rect.bottom - 1) / cellHeightPx)
              );
              if (right <= left || bottom < top) continue;
              const capacity = Math.max(1, right - left + 1);
              const segment = remaining.slice(0, capacity);
              putText(segment, left, right, top, bottom);
              remaining = remaining.slice(segment.length);
              if (!remaining) break;
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
        const colIdx = Math.max(0, Math.floor(pos.x / cellWidthPx));
        writeOverlay(rowIdx, colIdx, cursorLabel);
      }
    }

    // Top line: full URL of the current page
    const url = window.location.href;
    return url + '\n' + grid.map(row => row.join('')).join('\n');
  }, []);

  return capture;
}

export default useAsciiSnapshot;
