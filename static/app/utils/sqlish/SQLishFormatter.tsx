import * as Sentry from '@sentry/react';

import {simpleMarkup} from 'sentry/utils/sqlish/formatters/simpleMarkup';
import {string} from 'sentry/utils/sqlish/formatters/string';
import {SQLishParser} from 'sentry/utils/sqlish/SQLishParser';

type StringFormatterOptions = Parameters<typeof string>[1];

enum Format {
  STRING = 'string',
  SIMPLE_MARKUP = 'simpleMarkup',
}

const FORMATTERS = {
  [Format.STRING]: string,
  [Format.SIMPLE_MARKUP]: simpleMarkup,
};

export class SQLishFormatter {
  parser: SQLishParser;

  constructor() {
    this.parser = new SQLishParser();
  }

  toString(sql: string, options?: StringFormatterOptions) {
    return this.toFormat(sql, Format.STRING, options);
  }

  toSimpleMarkup(sql: string) {
    return this.toFormat(sql, Format.SIMPLE_MARKUP);
  }

  toFormat(sql: string, format: Format.STRING, options?: StringFormatterOptions): string;
  toFormat(sql: string, format: Format.SIMPLE_MARKUP): React.ReactElement[];
  toFormat(sql: string, format: Format, options?: StringFormatterOptions) {
    let tokens: any;

    const sentrySpan = Sentry.startInactiveSpan({
      op: 'function',
      name: 'SQLishFormatter.toFormat',
      attributes: {
        format,
      },
      onlyIfParent: true,
    });

    try {
      tokens = this.parser.parse(sql);
    } catch (error) {
      Sentry.withScope(scope => {
        scope.setFingerprint(['sqlish-parse-error']);
        // Get the last 100 characters of the error message
        scope.setExtra('message', error.message?.slice(-100));
        scope.setExtra('found', error.found);
        Sentry.captureException(error);
      });
      // If we fail to parse the SQL, return the original string
      return sql;
    }

    const formattedString = FORMATTERS[format](tokens, options);
    sentrySpan?.end();

    return formattedString;
  }
}
