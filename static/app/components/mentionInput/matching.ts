import type {MentionMatch, MentionMatchContext, MentionSource} from './types';

export interface ActiveMention extends MentionMatch {
  sourceId: string;
}

export function getRequestKey(activeMention: ActiveMention | null): string | null {
  return activeMention ? `${activeMention.sourceId}\u0000${activeMention.query}` : null;
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function findDefaultMatch({
  selectionEnd,
  selectionStart,
  text,
  trigger,
}: MentionMatchContext): MentionMatch | null {
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

export function findActiveMention<T>(
  text: string,
  selectionStart: number,
  selectionEnd: number,
  sources: ReadonlyArray<MentionSource<T>>
): ActiveMention | null {
  let activeMention: ActiveMention | null = null;

  for (const source of sources) {
    const context = {text, selectionStart, selectionEnd, trigger: source.trigger};
    const match = source.findMatch
      ? source.findMatch(context)
      : findDefaultMatch(context);
    if (!match || match.start < 0 || match.end < match.start || match.end > text.length) {
      continue;
    }

    if (!activeMention || match.start > activeMention.start) {
      activeMention = {...match, sourceId: source.id};
    }
  }

  return activeMention;
}
