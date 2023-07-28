import type {Token} from 'sentry/views/starfish/utils/sqlish/types';

export function string(tokens: Token[]): string {
  let accumulator = '';

  function contentize(content: Token): void {
    if (Array.isArray(content.content)) {
      content.content.forEach(contentize);
      return;
    }

    if (content.type === 'Keyword') {
      // Break up the string on newlines
      accumulator += '\n';
    }

    if (typeof content.content === 'string') {
      if (content.type === 'Whitespace') {
        // Convert all whitespace to single spaces
        accumulator += ' ';
      } else {
        accumulator += content.content;
      }

      return;
    }

    return;
  }

  tokens.forEach(contentize);
  return accumulator.trim();
}
