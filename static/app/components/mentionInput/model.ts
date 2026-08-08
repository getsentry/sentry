export interface Mention<T> {
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
  /** Source value selected by the user. */
  value: T;
}

export interface MentionInputValue<T> {
  mentions: ReadonlyArray<Mention<T>>;
  text: string;
}

/** Removes stale, malformed, and overlapping mention ranges from a value. */
export function normalizeMentionInputValue<T>(
  value: MentionInputValue<T>
): MentionInputValue<T> {
  const mentions: Array<Mention<T>> = [];
  let previousEnd = 0;

  for (const mention of value.mentions.toSorted((a, b) => a.start - b.start)) {
    if (
      !Number.isInteger(mention.start) ||
      !Number.isInteger(mention.end) ||
      mention.start < previousEnd ||
      mention.end <= mention.start ||
      mention.end > value.text.length ||
      value.text.slice(mention.start, mention.end) !== mention.text
    ) {
      continue;
    }

    mentions.push(mention);
    previousEnd = mention.end;
  }

  return mentions.length === value.mentions.length &&
    mentions.every((mention, index) => mention === value.mentions[index])
    ? value
    : {text: value.text, mentions};
}

/**
 * Repositions mentions around a single plain-text edit and removes any mention
 * whose text was edited.
 */
export function reconcileMentions<T>(
  previousValue: string,
  nextValue: string,
  mentions: ReadonlyArray<Mention<T>>
): ReadonlyArray<Mention<T>> {
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
