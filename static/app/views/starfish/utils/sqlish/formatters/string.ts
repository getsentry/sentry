import type {Token} from 'sentry/views/starfish/utils/sqlish/types';

export function string(tokens: Token[]): string {
  let accumulator = '';

  function contentize(token: Token): void {
    if (Array.isArray(token.content)) {
      token.content.forEach(contentize);
      return;
    }

    if (typeof token.content === 'string') {
      if (token.type === 'Keyword' && NEWLINE_KEYWORDS.has(token.content)) {
        accumulator += '\n';
        accumulator += token.content;
      } else if (token.type === 'Whitespace') {
        // Convert all whitespace to single spaces
        accumulator += ' ';
      } else {
        accumulator += token.content;
      }

      return;
    }

    return;
  }

  tokens.forEach(contentize);
  return accumulator.trim();
}

const NEWLINE_KEYWORDS = new Set([
  'DELETE',
  'FROM',
  'GROUP',
  'INSERT',
  'LIMIT',
  'OFFSET',
  'ON',
  'ORDER',
  'RETURNING',
  'SELECT',
  'VALUES',
  'WHERE',
]);
