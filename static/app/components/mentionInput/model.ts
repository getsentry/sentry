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

export interface MentionInputValue {
  mentions: readonly Mention[];
  text: string;
}

/**
 * Repositions mentions around a single plain-text edit and removes any mention
 * whose text was edited.
 */
export function reconcileMentions(
  previousValue: string,
  nextValue: string,
  mentions: readonly Mention[]
): readonly Mention[] {
  if (previousValue === nextValue) {
    return mentions;
  }

  let changeStart = 0;
  const sharedPrefixLength = Math.min(previousValue.length, nextValue.length);
  while (
    changeStart < sharedPrefixLength &&
    previousValue[changeStart] === nextValue[changeStart]
  ) {
    changeStart += 1;
  }

  let previousChangeEnd = previousValue.length;
  let nextChangeEnd = nextValue.length;
  while (
    previousChangeEnd > changeStart &&
    nextChangeEnd > changeStart &&
    previousValue[previousChangeEnd - 1] === nextValue[nextChangeEnd - 1]
  ) {
    previousChangeEnd -= 1;
    nextChangeEnd -= 1;
  }

  const offset = nextChangeEnd - previousChangeEnd;

  return mentions.flatMap(mention => {
    if (mention.end <= changeStart) {
      return mention;
    }

    if (mention.start >= previousChangeEnd) {
      return {
        ...mention,
        start: mention.start + offset,
        end: mention.end + offset,
      };
    }

    return [];
  });
}
