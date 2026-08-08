import {useCallback, useLayoutEffect, useRef} from 'react';

import type {EditorSelection} from './dom';
import type {MentionInputValue} from './model';

export type HistoryEditKind = 'deleteBackward' | 'deleteForward' | 'insertText' | 'other';

interface HistoryEntry<T> {
  selection: EditorSelection;
  value: MentionInputValue<T>;
}

interface CoalescedEdit {
  afterSelection: EditorSelection;
  kind: HistoryEditKind;
  timestamp: number;
}

interface UseEditorHistoryOptions<T> {
  onChange: (value: MentionInputValue<T>) => void;
  onRestoreSelection: (selection: EditorSelection) => void;
  value: MentionInputValue<T>;
}

const COALESCE_WINDOW = 1000;
const MAX_HISTORY_ENTRIES = 100;

function isSameValue<T>(
  first: MentionInputValue<T>,
  second: MentionInputValue<T>
): boolean {
  return (
    first.text === second.text &&
    first.mentions.length === second.mentions.length &&
    first.mentions.every((mention, index) => {
      const other = second.mentions[index];
      return (
        mention.id === other?.id &&
        mention.sourceId === other?.sourceId &&
        mention.start === other?.start &&
        mention.end === other?.end &&
        mention.text === other?.text &&
        mention.value === other?.value
      );
    })
  );
}

function isCollapsed(selection: EditorSelection): boolean {
  return selection.start === selection.end;
}

export function useEditorHistory<T>({
  onChange,
  onRestoreSelection,
  value,
}: UseEditorHistoryOptions<T>) {
  const undoStackRef = useRef<Array<HistoryEntry<T>>>([]);
  const redoStackRef = useRef<Array<HistoryEntry<T>>>([]);
  const coalescedEditRef = useRef<CoalescedEdit | null>(null);
  const expectedValueRef = useRef<MentionInputValue<T> | null>(null);

  const breakHistoryGroup = useCallback(() => {
    coalescedEditRef.current = null;
  }, []);

  useLayoutEffect(() => {
    const expectedValue = expectedValueRef.current;
    if (expectedValue && isSameValue(expectedValue, value)) {
      expectedValueRef.current = null;
      return;
    }

    undoStackRef.current = [];
    redoStackRef.current = [];
    coalescedEditRef.current = null;
    expectedValueRef.current = null;
  }, [value]);

  const emit = useCallback(
    (nextValue: MentionInputValue<T>) => {
      expectedValueRef.current = nextValue;
      onChange(nextValue);
    },
    [onChange]
  );

  const commit = useCallback(
    (
      nextValue: MentionInputValue<T>,
      beforeSelection: EditorSelection,
      afterSelection: EditorSelection,
      kind: HistoryEditKind = 'other'
    ) => {
      if (isSameValue(value, nextValue)) {
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
