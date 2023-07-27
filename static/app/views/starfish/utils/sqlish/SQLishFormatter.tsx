import * as Sentry from '@sentry/react';

import {SQLishParser} from 'sentry/views/starfish/utils/sqlish/SQLishParser';
import type {Token} from 'sentry/views/starfish/utils/sqlish/types';

export class SQLishFormatter {
  parser: SQLishParser;
  tokens?: Token[];

  constructor() {
    this.parser = new SQLishParser();
  }

  toString(sql) {
    let tokens: Token[] | undefined;

    try {
      tokens = this.parser.parse(sql);
    } catch (error) {
      Sentry.captureException(error);
      // If we fail to parse the SQL, return the original string, so there is always output
      return sql;
    }

    let ret = '';

    function contentize(content: Token) {
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
