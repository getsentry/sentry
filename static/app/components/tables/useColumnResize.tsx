import {useCallback, useRef} from 'react';

interface UseColumnResizeOptions<T extends HTMLElement> {
  /**
   * Build the `gridTemplateColumns` string while `columnIndex` is being resized to `newWidth`.
   */
  getResizeTemplate: (columnIndex: number, newWidth: number) => string;

  /**
   * The grid element whose `gridTemplateColumns` is mutated during a resize.
   */
  gridRef: React.RefObject<T | null>;

  /**
   * Persist the finalized width once the resize ends.
   */
  onColumnResizeEnd?: (columnIndex: number, newWidth: number) => void;
}

interface ColumnResizeState {
  columnIndex: number;
  moved: boolean;
  width: number;
}

/**
 * Shared column-resize mechanic for the sanctioned table shells. Owns the width
 * accumulation and the imperative write to the grid's `gridTemplateColumns`; the
 * handles themselves own the interaction and report movement as a delta.
 */
export function useColumnResize<T extends HTMLElement>({
  gridRef,
  getResizeTemplate,
  onColumnResizeEnd,
}: UseColumnResizeOptions<T>) {
  const resizeStateRef = useRef<ColumnResizeState | null>(null);
  const frameRef = useRef<number | null>(null);

  const cancelPendingFrame = useCallback(() => {
    if (frameRef.current !== null) {
      window.cancelAnimationFrame(frameRef.current);
      frameRef.current = null;
    }
  }, []);

  const applyTemplate = useCallback(
    (template: string) => {
      const grid = gridRef.current;
      if (!grid) {
        return;
      }

      grid.style.gridTemplateColumns = template;
    },
    [gridRef]
  );

  const onResizeStart = useCallback((columnIndex: number, cell: HTMLElement | null) => {
    resizeStateRef.current = {columnIndex, moved: false, width: cell?.offsetWidth ?? 0};
  }, []);

  const onResizeMove = useCallback(
    (delta: number) => {
      const state = resizeStateRef.current;
      if (!state) {
        return;
      }

      // Accumulated at full precision, but reported rounded: pointer deltas are
      // fractional on a scaled display, and a consumer may persist the width.
      state.width += delta;
      state.moved = true;

      // Several pointer moves can land in one frame, and they would all write the
      // same template, so only the newest is kept.
      cancelPendingFrame();

      frameRef.current = window.requestAnimationFrame(() => {
        frameRef.current = null;
        applyTemplate(getResizeTemplate(state.columnIndex, Math.round(state.width)));
      });
    },
    [applyTemplate, cancelPendingFrame, getResizeTemplate]
  );

  const onResizeEnd = useCallback(() => {
    const state = resizeStateRef.current;
    if (!state) {
      return;
    }

    // Written synchronously rather than left to the dropped frame: consumers that only
    // track widths through `getResizeTemplate` have no other chance to see the last one.
    cancelPendingFrame();
    resizeStateRef.current = null;

    // A drag that never travelled along the axis has nothing to commit, and committing
    // would pin an auto-sized column to the width it happened to have.
    if (!state.moved) {
      return;
    }

    const width = Math.round(state.width);
    applyTemplate(getResizeTemplate(state.columnIndex, width));
    onColumnResizeEnd?.(state.columnIndex, width);
  }, [applyTemplate, cancelPendingFrame, getResizeTemplate, onColumnResizeEnd]);

  return {applyTemplate, onResizeEnd, onResizeMove, onResizeStart};
}
