import {useCallback, useEffect, useRef} from 'react';

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
   * Persist the finalized width once the drag ends (`mouseup`).
   */
  onColumnResizeEnd?: (columnIndex: number, newWidth: number) => void;

  /**
   * Whether to set the `--grid-editable-resizer-height` CSS var to the rendered height after writing.
   */
  writeResizerHeightVar?: boolean;
}

interface ColumnResizeState {
  columnIndex: number;
  startWidth: number;
  startX: number;
}

/**
 * Shared column-resize drag mechanic for the sanctioned table shells. Owns the
 * pointer lifecycle (`mousedown` -> window `mousemove`/`mouseup` -> cleanup) and the
 * imperative write to the grid's `gridTemplateColumns`.
 */
export function useColumnResize<T extends HTMLElement>({
  gridRef,
  getResizeTemplate,
  onColumnResizeEnd,
  writeResizerHeightVar = false,
}: UseColumnResizeOptions<T>) {
  const resizeStateRef = useRef<ColumnResizeState | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const applyTemplate = useCallback(
    (template: string) => {
      const grid = gridRef.current;
      if (!grid) {
        return;
      }

      grid.style.gridTemplateColumns = template;

      if (writeResizerHeightVar) {
        grid.style.setProperty(
          '--grid-editable-resizer-height',
          `${grid.offsetHeight}px`
        );
      }
    },
    [gridRef, writeResizerHeightVar]
  );

  const onResizeMouseDown = useCallback(
    (event: React.MouseEvent, columnIndex = -1) => {
      event.stopPropagation();
      event.preventDefault();

      // Block right-click and other funky stuff.
      if (columnIndex === -1 || event.type === 'contextmenu') {
        return;
      }

      // The resize handle is expected to be nested 1 level down from the head cell.
      const cell = event.currentTarget.parentElement;
      if (!cell) {
        return;
      }

      resizeStateRef.current = {
        columnIndex,
        startWidth: cell.offsetWidth,
        startX: event.clientX,
      };

      const onMouseMove = (e: MouseEvent) => {
        const state = resizeStateRef.current;
        if (!state) {
          return;
        }

        const newWidth = state.startWidth + (e.clientX - state.startX);

        window.requestAnimationFrame(() =>
          applyTemplate(getResizeTemplate(state.columnIndex, newWidth))
        );
      };

      const onMouseUp = (e: MouseEvent) => {
        const state = resizeStateRef.current;
        if (state) {
          onColumnResizeEnd?.(
            state.columnIndex,
            state.startWidth + (e.clientX - state.startX)
          );
        }
        resizeStateRef.current = null;
        abortControllerRef.current?.abort();
      };

      abortControllerRef.current?.abort();

      const abortController = new AbortController();
      abortControllerRef.current = abortController;

      const {signal} = abortController;
      window.addEventListener('mousemove', onMouseMove, {signal});
      window.addEventListener('mouseup', onMouseUp, {signal});
    },
    [applyTemplate, getResizeTemplate, onColumnResizeEnd]
  );

  useEffect(() => () => abortControllerRef.current?.abort(), []);

  return {onResizeMouseDown, applyTemplate};
}
