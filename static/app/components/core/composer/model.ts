export interface Mention {
  /** End offset in the editor text. */
  end: number;
  /** Stable identity returned by the source. */
  id: string;
  /** Source that produced this mention. */
  sourceId: string;
  /** Start offset in the editor text. */
  start: number;
  /** Exact editor text covered by this mention. */
  text: string;
}

export interface ComposerValue {
  mentions: readonly Mention[];
  text: string;
}

export interface TextRange {
  end: number;
  start: number;
}

/** Replaces `start..end` of the previous text with `text`. */
export interface TextEdit extends TextRange {
  text: string;
}

function overlapsRange(range: TextRange, start: number, end: number) {
  return range.start < end && range.end > start;
}

/**
 * Returns mentions whose range still covers their text, sorted and without
 * overlaps. Restored or externally edited values may carry stale ranges.
 */
export function getValidMentions({mentions, text}: ComposerValue): Mention[] {
  let previousEnd = 0;
  return mentions
    .toSorted((a, b) => a.start - b.start)
    .filter(mention => {
      const isValid =
        mention.start >= previousEnd &&
        mention.end > mention.start &&
        text.slice(mention.start, mention.end) === mention.text;
      if (isValid) {
        previousEnd = mention.end;
      }
      return isValid;
    });
}

function diffText(previous: string, next: string): TextEdit {
  let start = 0;
  const sharedLength = Math.min(previous.length, next.length);
  while (start < sharedLength && previous[start] === next[start]) {
    start += 1;
  }

  let previousEnd = previous.length;
  let nextEnd = next.length;
  while (
    previousEnd > start &&
    nextEnd > start &&
    previous[previousEnd - 1] === next[nextEnd - 1]
  ) {
    previousEnd -= 1;
    nextEnd -= 1;
  }

  return {start, end: previousEnd, text: next.slice(start, nextEnd)};
}

/**
 * Finds the single edit that turned `previous` into `next`.
 *
 * A prefix/suffix diff cannot tell which of two identical characters was
 * typed or deleted, which would shift mentions next to repeated text. The
 * selection before the edit and the caret after it locate the edit exactly
 * for typing, deleting, pasting, and cutting. Edits that do not fit that
 * shape, such as drag and drop, fall back to the diff.
 */
export function locateEdit(
  previous: string,
  next: string,
  selectionBefore: TextRange,
  caretAfter: number
): TextEdit {
  const start = Math.min(selectionBefore.start, caretAfter);
  const end = previous.length - (next.length - caretAfter);
  if (
    start >= 0 &&
    start <= end &&
    end <= previous.length &&
    previous.slice(0, start) === next.slice(0, start) &&
    previous.slice(end) === next.slice(caretAfter)
  ) {
    return {start, end, text: next.slice(start, caretAfter)};
  }

  return diffText(previous, next);
}

/**
 * Applies an edit while keeping mentions atomic: a deletion or replacement
 * that touches part of a mention removes the whole mention. Text inserted
 * strictly inside a mention turns that mention back into ordinary text.
 *
 * Pass `atomic: false` while an input method is composing, when the editor
 * must keep exactly the text the browser produced.
 */
export function applyTextEdit(
  value: ComposerValue,
  edit: TextEdit,
  {atomic = true}: {atomic?: boolean} = {}
): {caret: number; value: ComposerValue} {
  const mentions = getValidMentions(value);
  let {start, end} = edit;

  if (atomic && start < end) {
    for (const mention of mentions) {
      if (overlapsRange(mention, start, end)) {
        start = Math.min(start, mention.start);
        end = Math.max(end, mention.end);
      }
    }
  }

  const offset = edit.text.length - (end - start);
  const nextMentions = mentions.flatMap(mention => {
    if (mention.end <= start) {
      return mention;
    }
    if (mention.start >= end) {
      return {...mention, start: mention.start + offset, end: mention.end + offset};
    }
    return [];
  });

  return {
    caret: start + edit.text.length,
    value: {
      text: value.text.slice(0, start) + edit.text + value.text.slice(end),
      mentions: nextMentions,
    },
  };
}

/**
 * Moves an offset that falls inside a mention to one of its edges, so the
 * caret can never rest inside a mention. With `previousOffset`, the offset
 * continues in the direction it was moving; otherwise it goes to the nearest
 * edge.
 */
export function snapOffset(
  offset: number,
  mentions: readonly Mention[],
  previousOffset?: number
): number {
  const mention = mentions.find(item => item.start < offset && offset < item.end);
  if (!mention) {
    return offset;
  }

  if (previousOffset !== undefined) {
    if (previousOffset <= mention.start) {
      return mention.end;
    }
    if (previousOffset >= mention.end) {
      return mention.start;
    }
  }

  return offset - mention.start < mention.end - offset ? mention.start : mention.end;
}

/**
 * Returns the range a Backspace or Delete keypress should remove so that it
 * deletes whole mentions, or null when the browser's own range is fine.
 */
export function getAtomicDeletionRange(
  mentions: readonly Mention[],
  selection: TextRange,
  direction: 'backward' | 'forward'
): TextRange | null {
  if (selection.start === selection.end) {
    const caret = selection.start;
    const mention = mentions.find(item =>
      direction === 'backward'
        ? item.start < caret && caret <= item.end
        : item.start <= caret && caret < item.end
    );
    return mention ? {start: mention.start, end: mention.end} : null;
  }

  let {start, end} = selection;
  for (const mention of mentions) {
    if (overlapsRange(mention, start, end)) {
      start = Math.min(start, mention.start);
      end = Math.max(end, mention.end);
    }
  }

  return start === selection.start && end === selection.end ? null : {start, end};
}

/** Whether a range overlaps any mention, for example a trigger typed after one. */
export function overlapsMention(mentions: readonly Mention[], range: TextRange) {
  return mentions.some(mention => overlapsRange(mention, range.start, range.end));
}
