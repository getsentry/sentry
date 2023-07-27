import * as Sentry from '@sentry/react';

import {SQLishParser} from 'sentry/views/starfish/utils/sqlish/SQLishParser';
import type {Token} from 'sentry/views/starfish/utils/sqlish/types';

export class SQLishFormatter {
  parser: SQLishParser;
  tokens?: Token[];

  constructor() {
    this.parser = new SQLishParser();
  }

  toString(sql: string): string;
  toString(tokens: Token[]): string;
  toString(input: string | Token[]): string {
    if (typeof input === 'string') {
      try {
        const tokens = this.parser.parse(input);
        return this.toString(tokens);
      } catch (error) {
        Sentry.captureException(error);
        // If we fail to parse the SQL, return the original string, so there is always output
        return input;
      }
    }

    const tokens = input;
    let ret = '';

    function contentize(content: Token): void {
      if (content.type === 'Keyword') {
        ret += '\n';
      }

      if (Array.isArray(content.content)) {
        content.content.forEach(contentize);
        return;
      }

      if (typeof content.content === 'string') {
        if (content.type === 'Whitespace') {
          ret += ' ';
        } else {
          ret += content.content;
        }
        return;
      }

      return;
    }

    tokens.forEach(contentize);
    return ret.trim();
  }
}
