interface MentionMatch {
  end: number;
  query: string;
  start: number;
}

export interface ActiveMention extends MentionMatch {
  sourceId: string;
}

export function getRequestKey(activeMention: ActiveMention | null): string | null {
  return activeMention ? `${activeMention.sourceId}\u0000${activeMention.query}` : null;
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function findDefaultMatch(
  text: string,
  selectionStart: number,
  selectionEnd: number,
  trigger: string
): MentionMatch | null {
  if (selectionStart !== selectionEnd) {
    return null;
  }

  const escapedTrigger = escapeRegExp(trigger);
  const match = text
    .slice(0, selectionStart)
    .match(new RegExp(`(?:^|\\s)(${escapedTrigger}([^\\s${escapedTrigger}]*))$`));
  if (!match?.[1]) {
    return null;
  }

  return {
    start: selectionStart - match[1].length,
    end: selectionStart,
    query: match[2] ?? '',
  };
}

export function findActiveMention(
  text: string,
  selectionStart: number,
  selectionEnd: number,
  sources: ReadonlyArray<{id: string; trigger: string}>
): ActiveMention | null {
  let activeMention: ActiveMention | null = null;

  for (const source of sources) {
    const match = findDefaultMatch(text, selectionStart, selectionEnd, source.trigger);
    if (!match || match.start < 0 || match.end < match.start || match.end > text.length) {
      continue;
    }

    if (!activeMention || match.start > activeMention.start) {
      activeMention = {...match, sourceId: source.id};
    }
  }

  return activeMention;
}
