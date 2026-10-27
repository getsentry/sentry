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

/**
 * Returns the mentions that can be rendered for `text`: sorted, non-overlapping,
 * and covering exactly their own `text`. Stale ranges render as plain text.
 */
export function getRenderableMentions({mentions, text}: ComposerValue): Mention[] {
  const renderable: Mention[] = [];
  let previousEnd = 0;

  for (const mention of mentions.toSorted((a, b) => a.start - b.start)) {
    if (
      mention.start >= previousEnd &&
      mention.end > mention.start &&
      mention.end <= text.length &&
      text.slice(mention.start, mention.end) === mention.text
    ) {
      renderable.push(mention);
      previousEnd = mention.end;
    }
  }

  return renderable;
}

export function isSameComposerValue(a: ComposerValue, b: ComposerValue): boolean {
  if (a === b) {
    return true;
  }

  return (
    a.text === b.text &&
    a.mentions.length === b.mentions.length &&
    a.mentions.every((mention, index) => {
      const other = b.mentions[index];
      return (
        other !== undefined &&
        mention.start === other.start &&
        mention.end === other.end &&
        mention.id === other.id &&
        mention.sourceId === other.sourceId &&
        mention.text === other.text
      );
    })
  );
}
