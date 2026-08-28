interface TriggerMatch {
  end: number;
  query: string;
  start: number;
}

export interface ActiveTrigger extends TriggerMatch {
  sourceId: string;
}

export function getRequestKey(activeTrigger: ActiveTrigger | null): string | null {
  return activeTrigger ? `${activeTrigger.sourceId}\u0000${activeTrigger.query}` : null;
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function findDefaultMatch(
  text: string,
  selectionStart: number,
  selectionEnd: number,
  trigger: string
): TriggerMatch | null {
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

export function findActiveTrigger(
  text: string,
  selectionStart: number,
  selectionEnd: number,
  sources: ReadonlyArray<{id: string; trigger: string}>
): ActiveTrigger | null {
  let activeTrigger: ActiveTrigger | null = null;

  for (const source of sources) {
    const match = findDefaultMatch(text, selectionStart, selectionEnd, source.trigger);
    if (!match || match.start < 0 || match.end < match.start || match.end > text.length) {
      continue;
    }

    if (!activeTrigger || match.start > activeTrigger.start) {
      activeTrigger = {...match, sourceId: source.id};
    }
  }

  return activeTrigger;
}
