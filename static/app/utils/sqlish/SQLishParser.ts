import type {Token} from 'sentry/utils/sqlish/types';

import grammar from './sqlish.pegjs';

export class SQLishParser {
  parse(sql: string) {
    return grammar.parse(sql) as Token[];
  }
}
