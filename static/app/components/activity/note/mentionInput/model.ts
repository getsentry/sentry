export interface MentionSuggestion {
  /** Stable value sent to the note API when this suggestion is inserted. */
  id: string;
  /** Searchable and screen-reader-readable label. */
  label: string;
  /** Optional source-specific data for custom rendering. */
  payload?: unknown;
}

export interface MentionValue {
  /** End offset in the editor's plain-text value. */
  end: number;
  /** ID sent to the note API. */
  id: string;
  /** Markdown replacement used when serializing the note. */
  markup: string;
  /** Source that produced this mention. */
  sourceId: string;
  /** Start offset in the editor's plain-text value. */
  start: number;
  /** Exact plain text covered by this mention. */
  text: string;
  /** Original suggestion used to render source-specific token contents. */
  suggestion?: MentionSuggestion;
}

/**
 * Repositions mentions around a single plain-text edit and removes any mention
 * whose text was edited.
 */
export function reconcileMentions(
  previousValue: string,
  nextValue: string,
  mentions: readonly MentionValue[]
): readonly MentionValue[] {
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

/** Serializes plain text plus structured mention ranges to note markdown. */
export function serializeMentions(
  value: string,
  mentions: readonly MentionValue[]
): string {
  let serializedValue = value;

  for (const mention of mentions.toSorted((a, b) => b.start - a.start)) {
    if (value.slice(mention.start, mention.end) !== mention.text) {
      continue;
    }

    serializedValue =
      serializedValue.slice(0, mention.start) +
      mention.markup +
      serializedValue.slice(mention.end);
  }

  return serializedValue;
}
