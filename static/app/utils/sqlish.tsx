/**
 * Thin wrapper around @sentry/sqlish that adds Sentry observability
 * (performance spans and error capture with fingerprinting on parse failures)
 * and re-adds `toSimpleMarkup()` which the npm package doesn't include as a
 * class method — it ships `simpleMarkup` as a standalone function from
 * `@sentry/sqlish/react` instead.
 */
import * as Sentry from '@sentry/react';
import {SQLishFormatter as BaseSQLishFormatter, SQLishParser} from '@sentry/sqlish';
import {simpleMarkup} from '@sentry/sqlish/react';

type StringFormatterOptions = Parameters<BaseSQLishFormatter['toString']>[1];

export class SQLishFormatter {
  private formatter: BaseSQLishFormatter;
  private parser: SQLishParser;

  constructor() {
    this.formatter = new BaseSQLishFormatter();
    this.parser = new SQLishParser();
  }

  toString(sql: string, options?: StringFormatterOptions): string {
    return this._withSentry('string', () => this.formatter.toString(sql, options), sql);
  }

  toSimpleMarkup(sql: string): React.ReactElement[] {
    return this._withSentry(
      'simpleMarkup',
      () => simpleMarkup(this.parser.parse(sql)),
      sql
    );
  }

  private _withSentry<T>(format: string, fn: () => T, sql: string): T {
    const sentrySpan = Sentry.startInactiveSpan({
      op: 'function',
      name: 'SQLishFormatter.toFormat',
      attributes: {format},
      onlyIfParent: true,
    });

    try {
      const result = fn();
      return result;
    } catch (error: any) {
      Sentry.withScope(scope => {
        const fingerprint = ['sqlish-parse-error'];

        if (error?.message) {
          scope.setExtra('message', error.message?.slice(-100));
          scope.setExtra('found', error.found);

          if (error.message.includes('Expected')) {
            fingerprint.push(error.message.slice(-10));
          }
        }

        scope.setFingerprint(fingerprint);
        Sentry.captureException(error);
      });

      // If we fail to parse the SQL, return the original string
      return sql as unknown as T;
    } finally {
      sentrySpan?.end();
    }
  }
}
