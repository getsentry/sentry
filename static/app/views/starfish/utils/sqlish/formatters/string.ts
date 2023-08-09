import type {Token} from 'sentry/views/starfish/utils/sqlish/types';

export function string(tokens: Token[]): string {
  let accumulator = '';

  function contentize(content: Token): void {
    if (Array.isArray(content.content)) {
      content.content.forEach(contentize);
      return;
    }

    if (typeof content.content === 'string') {
      if (content.type === 'Keyword' && NEWLINE_KEYWORDS.has(content.content)) {
        accumulator += '\n';
        accumulator += content.content;
      } else if (content.type === 'Whitespace') {
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
