import * as Sentry from '@sentry/react';

import {string} from 'sentry/views/starfish/utils/sqlish/formatters/string';
import {SQLishParser} from 'sentry/views/starfish/utils/sqlish/SQLishParser';

enum Format {
  STRING = 'string',
}

const FORMATTERS = {
  [Format.STRING]: string,
};

export class SQLishFormatter {
  parser: SQLishParser;

  constructor() {
    this.parser = new SQLishParser();
  }

  toString(sql: string) {
    return this.toFormat(sql, Format.STRING);
  }

  toFormat(sql: string, format: Format.STRING): string {
    let tokens;

    try {
      tokens = this.parser.parse(sql);
    } catch (error) {
      Sentry.captureException(error);
      // If we fail to parse the SQL, return the original string
      return sql;
    }

    return FORMATTERS[format](tokens);
  }
}
