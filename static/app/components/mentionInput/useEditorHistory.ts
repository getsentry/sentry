import {useCallback, useLayoutEffect, useRef} from 'react';
import isEqual from 'lodash/isEqual';

import type {EditorSelection} from './dom';
import type {MentionInputValue} from './model';

export type HistoryEditKind = 'deleteBackward' | 'deleteForward' | 'insertText' | 'other';

interface HistoryEntry {
  selection: EditorSelection;
  value: MentionInputValue;
}

interface CoalescedEdit {
  afterSelection: EditorSelection;
  kind: HistoryEditKind;
  timestamp: number;
}

interface UseEditorHistoryOptions {
  onChange: (value: MentionInputValue) => void;
  onRestoreSelection: (selection: EditorSelection) => void;
  value: MentionInputValue;
}

const COALESCE_WINDOW = 1000;
const MAX_HISTORY_ENTRIES = 100;

function isCollapsed(selection: EditorSelection): boolean {
  return selection.start === selection.end;
}

export function useEditorHistory({
  onChange,
  onRestoreSelection,
  value,
}: UseEditorHistoryOptions) {
  const undoStackRef = useRef<HistoryEntry[]>([]);
  const redoStackRef = useRef<HistoryEntry[]>([]);
  const coalescedEditRef = useRef<CoalescedEdit | null>(null);
  const expectedValueRef = useRef<MentionInputValue | null>(null);

  const breakHistoryGroup = useCallback(() => {
    coalescedEditRef.current = null;
  }, []);

  useLayoutEffect(() => {
    const expectedValue = expectedValueRef.current;
    if (expectedValue && isEqual(expectedValue, value)) {
      expectedValueRef.current = null;
      return;
    }

    undoStackRef.current = [];
    redoStackRef.current = [];
    coalescedEditRef.current = null;
    expectedValueRef.current = null;
  }, [value]);

  const emit = useCallback(
    (nextValue: MentionInputValue) => {
      expectedValueRef.current = nextValue;
      onChange(nextValue);
    },
    [onChange]
  );

  const commit = useCallback(
    (
      nextValue: MentionInputValue,
      beforeSelection: EditorSelection,
      afterSelection: EditorSelection,
      kind: HistoryEditKind = 'other'
    ) => {
      if (isEqual(value, nextValue)) {
        return;
      }

      const previousEdit = coalescedEditRef.current;
      const now = Date.now();
      const shouldCoalesce =
        kind !== 'other' &&
        previousEdit?.kind === kind &&
        now - previousEdit.timestamp < COALESCE_WINDOW &&
        isCollapsed(beforeSelection) &&
        isCollapsed(afterSelection) &&
        previousEdit.afterSelection.start === beforeSelection.start;

      if (!shouldCoalesce) {
        undoStackRef.current.push({value, selection: beforeSelection});
        if (undoStackRef.current.length > MAX_HISTORY_ENTRIES) {
          undoStackRef.current.shift();
        }
      }

      redoStackRef.current = [];
      coalescedEditRef.current = {kind, afterSelection, timestamp: now};
      emit(nextValue);
    },
    [emit, value]
  );

  const undo = useCallback(
    (currentSelection: EditorSelection) => {
      const previous = undoStackRef.current.pop();
      if (!previous) {
        return false;
      }

      redoStackRef.current.push({value, selection: currentSelection});
      breakHistoryGroup();
      onRestoreSelection(previous.selection);
      emit(previous.value);
      return true;
    },
    [breakHistoryGroup, emit, onRestoreSelection, value]
  );

  const redo = useCallback(
    (currentSelection: EditorSelection) => {
      const next = redoStackRef.current.pop();
      if (!next) {
        return false;
      }

      undoStackRef.current.push({value, selection: currentSelection});
      breakHistoryGroup();
      onRestoreSelection(next.selection);
      emit(next.value);
      return true;
    },
    [breakHistoryGroup, emit, onRestoreSelection, value]
  );

  return {breakHistoryGroup, commit, redo, undo};
}
