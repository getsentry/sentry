import {Location} from 'history';

import {defined} from 'sentry/utils';
import {ModuleName} from 'sentry/views/starfish/types';
import {NULL_SPAN_CATEGORY} from 'sentry/views/starfish/views/webServiceView/spanGroupBreakdownContainer';

const SPAN_FILTER_KEYS = [
  'span.op',
  'span.domain',
  'span.action',
  '!span.module',
  '!span.category',
];

export function buildEventViewQuery(
  moduleName: ModuleName,
  location: Location,
  transaction?: string,
  method?: string,
  spanCategory?: string
) {
  const {query} = location;
  const result = Object.keys(query)
    .filter(key => SPAN_FILTER_KEYS.includes(key))
    .filter(key => Boolean(query[key]))
    .map(key => {
      const value = query[key];
      const isArray = Array.isArray(value);

      if (key === '!span.category' && isArray && value.includes('db')) {
        // When omitting database spans, explicitly allow `db.redis` spans, because
        // we're not including those spans in the database category
        const categoriesAsideFromDatabase = value.filter(v => v !== 'db');
        return `(!span.category:db OR span.op:db.redis) !span.category:[${categoriesAsideFromDatabase.join(
          ','
        )}]`;
      }

      return `${key}:${isArray ? `[${value}]` : value}`;
    });

  result.push('has:span.description');

  if (moduleName !== ModuleName.ALL) {
    result.push(`span.module:${moduleName}`);
  }

  if (moduleName === ModuleName.DB) {
    result.push('!span.op:db.redis');
  }

  if (defined(spanCategory)) {
    if (spanCategory === NULL_SPAN_CATEGORY) {
      result.push(`!has:span.category`);
    } else if (spanCategory !== 'Other') {
      result.push(`span.category:${spanCategory}`);
    }
  }

  if (transaction) {
    result.push(`transaction:${transaction}`);
  }

  if (method) {
    result.push(`transaction.method:${method}`);
  }

  return result;
}
