import type {Token} from 'sentry/views/starfish/utils/sql/types';

import grammar from './sqlish.pegjs';

export class SQLishFormatter {
  sql: string;
  tokens: Token[];

  constructor(sql: string) {
    this.sql = sql;
    this.tokens = grammar.parse(sql);
  }

  toString() {
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

    this.tokens.forEach(contentize);
    return ret.trim();
  }
}
