import type {Token} from 'sentry/views/starfish/utils/sqlish/types';

export function string(tokens: Token[]): string {
  let accumulator = '';

  let precedingNonWhitespaceToken: Token | undefined = undefined;
  let indentation: number = 0; // Track the current indent level
  let parenthesisLevel: number = 0; // Tracks the current parenthesis nesting level
  const indentationLevels: number[] = []; // Tracks the parenthesis nesting levels at which we've incremented the indentation

  function contentize(token: Token): void {
    if (Array.isArray(token.content)) {
      token.content.forEach(contentize);
      return;
    }

    if (token.type === 'LeftParenthesis') {
      parenthesisLevel += 1;
      accumulator += '(';

      // If the previous legible token is a meaningful keyword that triggers a
      // newline, increase the current indentation level and note the parenthesis level where this happened
      if (
        typeof precedingNonWhitespaceToken?.content === 'string' &&
        PARENTHESIS_NEWLINE_KEYWORDS.has(precedingNonWhitespaceToken.content)
      ) {
        accumulator += NEWLINE;

        indentation += 1;
        indentationLevels.push(parenthesisLevel);
      }
    }

    if (token.type === 'RightParenthesis') {
      // If this right parenthesis closes a left parenthesis at a level where
      // we incremented the indentation, decrement the indentation
      if (indentationLevels.at(-1) === parenthesisLevel) {
        accumulator += NEWLINE;
        indentation -= 1;
        accumulator += INDENTATION.repeat(indentation);
        indentationLevels.pop();
      }

      parenthesisLevel -= 1;
      accumulator += ')';
    }

    if (typeof token.content === 'string') {
      if (token.type === 'Keyword' && NEWLINE_KEYWORDS.has(token.content)) {
        if (!accumulator.endsWith(NEWLINE)) {
          accumulator += NEWLINE;
        }

        accumulator += INDENTATION.repeat(indentation);
        accumulator += token.content;
      } else if (token.type === 'Whitespace') {
        // Convert all whitespace to single spaces
        accumulator += ' ';
      } else if (['LeftParenthesis', 'RightParenthesis'].includes(token.type)) {
        // Parenthesis contents are appended above, so we can skip them here
        accumulator += '';
      } else {
        if (accumulator.endsWith(NEWLINE)) {
          accumulator += INDENTATION.repeat(indentation);
        }
        accumulator += token.content;
      }
    }

    if (token.type !== 'Whitespace') {
      precedingNonWhitespaceToken = token;
    }

    return;
  }

  tokens.forEach(contentize);
  return accumulator.trim();
}

const INDENTATION = '  ';
const NEWLINE = '\n';

// Keywords that always trigger a newline
const NEWLINE_KEYWORDS = new Set([
  'DELETE',
  'FROM',
  'GROUP',
  'INNER',
  'INSERT',
  'LEFT',
  'LIMIT',
  'OFFSET',
  'ORDER',
  'RETURNING',
  'RIGHT',
  'SELECT',
  'VALUES',
  'WHERE',
]);

// Keywords that may or may not trigger a newline, but they always trigger a newlines if followed by a parenthesis
const PARENTHESIS_NEWLINE_KEYWORDS = new Set([...NEWLINE_KEYWORDS, ...['IN']]);
