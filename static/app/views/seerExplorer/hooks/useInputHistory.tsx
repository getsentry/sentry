import {useCallback, useRef} from 'react';

import {localStorageWrapper} from 'sentry/utils/localStorage';

/** How many of the user's sent messages to remember, across all runs. */
const INPUT_HISTORY_LIMIT = 25;

const INPUT_HISTORY_STORAGE_KEY_PREFIX = 'seer-explorer-input-history';

function getStorageKey(userId: string) {
  return `${INPUT_HISTORY_STORAGE_KEY_PREFIX}:${userId}`;
}

/** Oldest first. Read fresh on each use so every open surface sees the same list. */
function readInputHistory(userId: string): string[] {
  try {
    const parsed = JSON.parse(localStorageWrapper.getItem(getStorageKey(userId)) ?? '[]');
    return Array.isArray(parsed)
      ? parsed.filter((item): item is string => typeof item === 'string')
      : [];
  } catch {
    return [];
  }
}

function writeInputHistory(userId: string, history: string[]) {
  try {
    localStorageWrapper.setItem(getStorageKey(userId), JSON.stringify(history));
  } catch {
    // Storage full or unavailable; history is a convenience, so drop it.
  }
}

interface UseInputHistoryOptions {
  setValue: (value: string) => void;
  textAreaRef: React.RefObject<HTMLTextAreaElement | null>;
  userId: string;
  value: string;
}

/**
 * Shell-style Up/Down recall of the user's last sent messages. The history is
 * shared by every conversation, not kept per run.
 */
export function useInputHistory({
  userId,
  value,
  setValue,
  textAreaRef,
}: UseInputHistoryOptions) {
  // Index into the history being shown, or null when not browsing it.
  const indexRef = useRef<number | null>(null);
  // What was in the composer before browsing started, restored past the newest entry.
  const draftRef = useRef('');
  // The entry last put into the composer, to tell whether the user has since edited it.
  const shownRef = useRef<string | null>(null);

  const addToHistory = useCallback(
    (message: string) => {
      const trimmed = message.trim();
      indexRef.current = null;
      shownRef.current = null;
      if (!trimmed) {
        return;
      }
      const history = readInputHistory(userId).filter(item => item !== trimmed);
      history.push(trimmed);
      writeInputHistory(userId, history.slice(-INPUT_HISTORY_LIMIT));
    },
    [userId]
  );

  const show = useCallback(
    (text: string) => {
      shownRef.current = text;
      setValue(text);
      // Put the caret at the end once React has committed the new value.
      requestAnimationFrame(() => {
        const textArea = textAreaRef.current;
        textArea?.setSelectionRange(text.length, text.length);
      });
    },
    [setValue, textAreaRef]
  );

  /** Returns true when the key was used to navigate history. */
  const handleHistoryKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>): boolean => {
      if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') {
        return false;
      }
      if (e.shiftKey || e.altKey || e.ctrlKey || e.metaKey) {
        return false;
      }

      // Once the user edits a recalled entry, it becomes their draft.
      if (indexRef.current !== null && value !== shownRef.current) {
        indexRef.current = null;
        shownRef.current = null;
      }

      const isBrowsing = indexRef.current !== null;
      // Outside of browsing, only take over the arrow keys when the caret can't
      // move any further, so multi-line drafts can still be navigated.
      if (!isBrowsing) {
        const {selectionStart, selectionEnd} = e.currentTarget;
        if (selectionStart !== selectionEnd) {
          return false;
        }
        const onFirstLine = !value.slice(0, selectionStart).includes('\n');
        const onLastLine = !value.slice(selectionEnd).includes('\n');
        if (
          (e.key === 'ArrowUp' && !onFirstLine) ||
          (e.key === 'ArrowDown' && !onLastLine)
        ) {
          return false;
        }
      }

      const history = readInputHistory(userId);

      if (e.key === 'ArrowUp') {
        if (history.length === 0) {
          return false;
        }
        if (indexRef.current === null) {
          draftRef.current = value;
          indexRef.current = history.length - 1;
        } else {
          indexRef.current = Math.max(0, Math.min(indexRef.current, history.length) - 1);
        }
        e.preventDefault();
        show(history[indexRef.current] ?? '');
        return true;
      }

      // ArrowDown
      if (indexRef.current === null) {
        return false;
      }
      e.preventDefault();
      if (indexRef.current + 1 < history.length) {
        indexRef.current += 1;
        show(history[indexRef.current] ?? '');
      } else {
        indexRef.current = null;
        show(draftRef.current);
        shownRef.current = null;
      }
      return true;
    },
    [userId, value, show]
  );

  return {addToHistory, handleHistoryKeyDown};
}
