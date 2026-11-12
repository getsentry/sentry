interface TriggerMatch {
  end: number;
  query: string;
  start: number;
}

export interface ActiveTrigger extends TriggerMatch {
  // The character that activated this trigger. Sources sharing this
  // character contribute suggestions to the same popup.
  trigger: string;
}

export function getRequestKey(activeTrigger: ActiveTrigger | null): string | null {
  return activeTrigger ? `${activeTrigger.trigger}\u0000${activeTrigger.query}` : null;
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function findDefaultMatch(
  text: string,
  selectionStart: number,
  selectionEnd: number,
  trigger: string,
  restrictToStart: boolean
): TriggerMatch | null {
  if (selectionStart !== selectionEnd) {
    return null;
  }

  const escapedTrigger = escapeRegExp(trigger);
  const boundary = restrictToStart ? '^' : '(?:^|\\s)';
  const match = text
    .slice(0, selectionStart)
    .match(new RegExp(`${boundary}(${escapedTrigger}([^\\s${escapedTrigger}]*))$`));
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
  sources: ReadonlyArray<{trigger: string; restrictToStart?: boolean}>
): ActiveTrigger | null {
  let activeTrigger: ActiveTrigger | null = null;

  for (const source of sources) {
    const match = findDefaultMatch(
      text,
      selectionStart,
      selectionEnd,
      source.trigger,
      source.restrictToStart ?? false
    );
    if (!match || match.start < 0 || match.end < match.start || match.end > text.length) {
      continue;
    }

    if (!activeTrigger || match.start > activeTrigger.start) {
      activeTrigger = {...match, trigger: source.trigger};
    }
  }

  return activeTrigger;
}
