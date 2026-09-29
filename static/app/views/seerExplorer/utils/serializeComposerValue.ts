import type {ComposerValue, Mention} from '@sentry/scraps/composer';

import type {Actor} from 'sentry/types/core';

export function getMentionActor(mention: Mention): Actor | null {
  const actor = /^(user|team):(.+)$/.exec(mention.id);
  if (!actor) {
    return null;
  }
  return {
    id: actor[2]!,
    type: actor[1] === 'user' ? 'user' : 'team',
    name: mention.text.slice(1),
  };
}

export function serializeComposerValue(value: ComposerValue): string {
  let text = value.text;

  for (const mention of value.mentions.toSorted((a, b) => b.start - a.start)) {
    const actor = getMentionActor(mention);
    if (
      !actor ||
      mention.start < 0 ||
      mention.end > value.text.length ||
      mention.start >= mention.end ||
      value.text.slice(mention.start, mention.end) !== mention.text
    ) {
      continue;
    }

    const data = JSON.stringify(actor).replaceAll('{%', '\\u007b%');
    text =
      text.slice(0, mention.start) +
      `{% user %}${data}{% /user %}` +
      text.slice(mention.end);
  }

  return text;
}
