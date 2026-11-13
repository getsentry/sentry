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

export function sliceComposerValue(
  value: ComposerValue,
  {start, end}: {end: number; start: number}
): ComposerValue {
  return {
    text: value.text.slice(start, end),
    mentions: getRenderableMentions(value)
      .filter(mention => mention.start >= start && mention.end <= end)
      .map(mention => ({
        ...mention,
        start: mention.start - start,
        end: mention.end - start,
      })),
  };
}

export function replaceComposerValue(
  value: ComposerValue,
  {start, end}: {end: number; start: number},
  fragment: ComposerValue
): ComposerValue {
  const mentions = getRenderableMentions(value);
  const shift = fragment.text.length - (end - start);
  return {
    text: value.text.slice(0, start) + fragment.text + value.text.slice(end),
    mentions: [
      ...mentions.filter(mention => mention.end <= start),
      ...getRenderableMentions(fragment).map(mention => ({
        ...mention,
        start: mention.start + start,
        end: mention.end + start,
      })),
      ...mentions
        .filter(mention => mention.start >= end)
        .map(mention => ({
          ...mention,
          start: mention.start + shift,
          end: mention.end + shift,
        })),
    ],
  };
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
