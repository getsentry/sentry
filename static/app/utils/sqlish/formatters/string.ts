import {StringAccumulator} from 'sentry/utils/sqlish/formatters/stringAccumulator';
import type {Token} from 'sentry/utils/sqlish/types';

interface Options {
  maxLineLength?: number;
}

export function string(tokens: Token[], options: Options = {}): string {
  const accumulator = new StringAccumulator();

  let precedingNonWhitespaceToken: Token | undefined = undefined;
  let parenthesisLevel = 0; // Tracks the current parenthesis nesting level
  const indentationLevels: number[] = []; // Tracks the parenthesis nesting levels at which we've incremented the indentation

  function contentize(token: Token): void {
    if (Array.isArray(token.content)) {
      token.content.forEach(contentize);
      return;
    }

    if (token.type === 'LeftParenthesis') {
      parenthesisLevel += 1;
      accumulator.add('(');

      // If the previous legible token is a meaningful keyword that triggers a
      // newline, increase the current indentation level and note the parenthesis level where this happened
      if (
        typeof precedingNonWhitespaceToken?.content === 'string' &&
        PARENTHESIS_NEWLINE_KEYWORDS.has(precedingNonWhitespaceToken.content)
      ) {
        accumulator.break();

        accumulator.indent();
        indentationLevels.push(parenthesisLevel);
      }
    }

    if (token.type === 'RightParenthesis') {
      // If this right parenthesis closes a left parenthesis at a level where
      // we incremented the indentation, decrement the indentation
      if (indentationLevels.at(-1) === parenthesisLevel) {
        accumulator.break();
        accumulator.unindent();
        indentationLevels.pop();
      }

      parenthesisLevel -= 1;
      accumulator.add(')');
    }

    if (typeof token.content === 'string') {
      if (token.type === 'Keyword' && NEWLINE_KEYWORDS.has(token.content)) {
        if (!accumulator.lastLine.isEmpty) {
          accumulator.break();
        }

        accumulator.add(token.content);
      } else if (token.type === 'Whitespace') {
        // Convert all whitespace to single spaces
        accumulator.space();
      } else if (['LeftParenthesis', 'RightParenthesis'].includes(token.type)) {
        // Parenthesis contents are appended above, so we can skip them here
      } else {
        accumulator.add(token.content);
      }
    }

    if (token.type !== 'Whitespace') {
      precedingNonWhitespaceToken = token;
    }

    return;
  }

  tokens.forEach(contentize);
  return accumulator.toString(options.maxLineLength);
}

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
