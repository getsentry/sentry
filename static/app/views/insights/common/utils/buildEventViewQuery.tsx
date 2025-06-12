import type {Location} from 'history';

import {t} from 'sentry/locale';
import {defined} from 'sentry/utils';
import {EMPTY_OPTION_VALUE} from 'sentry/utils/tokenizeSearch';
import {EXCLUDED_DB_OPS} from 'sentry/views/insights/database/settings';
import {ModuleName, SpanMetricsField} from 'sentry/views/insights/types';

const NULL_SPAN_CATEGORY = t('custom');

const {NORMALIZED_DESCRIPTION, SPAN_OP, SPAN_DOMAIN, SPAN_ACTION, SPAN_CATEGORY} =
  SpanMetricsField;

const SPAN_FILTER_KEYS = [SPAN_OP, SPAN_DOMAIN, SPAN_ACTION, `!${SPAN_CATEGORY}`];

export function buildEventViewQuery({
  moduleName,
  location,
  transaction,
  method,
  spanCategory,
}: {
  location: Location;
  moduleName: ModuleName;
  method?: string;
  spanCategory?: string;
  transaction?: string;
}) {
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
        return `(!span.category:db OR ${SPAN_OP}:db.redis) !span.category:[${categoriesAsideFromDatabase.join(
          ','
        )}]`;
      }

      if (value === EMPTY_OPTION_VALUE) {
        return `!has:${key}`;
      }

      return `${key}:${isArray ? `[${value}]` : value}`;
    });

  result.push(`has:${NORMALIZED_DESCRIPTION}`);
  result.push(`${SPAN_CATEGORY}:${moduleName}`);
  if (moduleName === ModuleName.DB) {
    result.push(`!${SPAN_OP}:[${EXCLUDED_DB_OPS.join(',')}]`);
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
