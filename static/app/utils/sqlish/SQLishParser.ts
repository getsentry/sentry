import type {Token} from 'sentry/utils/sqlish/types';

import {parse} from './sqlish.pegjs';

export class SQLishParser {
  parse(sql: string) {
    return parse(sql) as Token[];
  }
}
