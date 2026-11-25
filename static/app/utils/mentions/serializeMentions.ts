import type {ComposerValue} from '@sentry/scraps/composer';

export function serializeMentions(value: ComposerValue) {
  const mentions = value.mentions.filter(
    mention => value.text.slice(mention.start, mention.end) === mention.text
  );
  let text = value.text;

  for (const mention of mentions.toSorted((a, b) => b.start - a.start)) {
    text = text.slice(0, mention.start) + `**${mention.text}**` + text.slice(mention.end);
  }

  return {text, mentions: [...new Set(mentions.map(mention => mention.id))]};
}
