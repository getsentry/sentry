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
    resizeStateRef.current = {columnIndex, width: cell?.offsetWidth ?? 0};
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

      window.requestAnimationFrame(() =>
        applyTemplate(getResizeTemplate(state.columnIndex, Math.round(state.width)))
      );
    },
    [applyTemplate, getResizeTemplate]
  );

  const onResizeEnd = useCallback(() => {
    const state = resizeStateRef.current;
    if (!state) {
      return;
    }

    resizeStateRef.current = null;
    onColumnResizeEnd?.(state.columnIndex, Math.round(state.width));
  }, [onColumnResizeEnd]);

  return {applyTemplate, onResizeEnd, onResizeMove, onResizeStart};
}
