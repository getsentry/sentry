import type {Token} from 'sentry/views/starfish/utils/sqlish/types';

export function string(tokens: Token[]): string {
  const accumulator = new StringAccumulator();

  let precedingNonWhitespaceToken: Token | undefined = undefined;
  let indentation: number = 0; // Tracks the current indent level
  let parenthesisLevel: number = 0; // Tracks the current parenthesis nesting level
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

        indentation += 1;
        indentationLevels.push(parenthesisLevel);
      }
    }

    if (token.type === 'RightParenthesis') {
      // If this right parenthesis closes a left parenthesis at a level where
      // we incremented the indentation, decrement the indentation
      if (indentationLevels.at(-1) === parenthesisLevel) {
        accumulator.break();
        indentation -= 1;
        accumulator.add(INDENTATION.repeat(indentation));
        indentationLevels.pop();
      }

      parenthesisLevel -= 1;
      accumulator.add(')');
    }

    if (typeof token.content === 'string') {
      if (token.type === 'Keyword' && NEWLINE_KEYWORDS.has(token.content)) {
        if (!accumulator.endsWith(NEWLINE)) {
          accumulator.break();
        }

        accumulator.indent(indentation);
        accumulator.add(token.content);
      } else if (token.type === 'Whitespace') {
        // Convert all whitespace to single spaces
        accumulator.space();
      } else if (['LeftParenthesis', 'RightParenthesis'].includes(token.type)) {
        // Parenthesis contents are appended above, so we can skip them here
      } else {
        if (accumulator.endsWith(NEWLINE)) {
          accumulator.add(INDENTATION.repeat(indentation));
        }
        accumulator.add(token.content);
      }
    }

    if (token.type !== 'Whitespace') {
      precedingNonWhitespaceToken = token;
    }

    return;
  }

  tokens.forEach(contentize);
  return accumulator.toString();
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

class StringAccumulator {
  tokens: string[];

  constructor() {
    this.tokens = [];
  }

  add(token: string) {
    if (!token) {
      return;
    }

    this.tokens.push(token);
  }

  space() {
    this.rtrim();
    this.tokens.push(SPACE);
  }

  break() {
    this.rtrim();

    this.tokens.push(NEWLINE);
  }

  indent(count: number = 1) {
    this.tokens.push(INDENTATION.repeat(count));
  }

  rtrim() {
    while (this.tokens.at(-1)?.trim() === '') {
      this.tokens.pop();
    }
  }

  endsWith(token: string) {
    return this.tokens.at(-1) === token;
  }

  toString() {
    return this.tokens.join('').trim();
  }
}

const SPACE = ' ';
const INDENTATION = '  ';
const NEWLINE = '\n';
