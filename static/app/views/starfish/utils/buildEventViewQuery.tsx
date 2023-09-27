import {Location} from 'history';

import {defined} from 'sentry/utils';
import {ModuleName, SpanMetricsField} from 'sentry/views/starfish/types';
import {EMPTY_OPTION_VALUE} from 'sentry/views/starfish/views/spans/selectors/emptyOption';
import {NULL_SPAN_CATEGORY} from 'sentry/views/starfish/views/webServiceView/spanGroupBreakdownContainer';

const {SPAN_DESCRIPTION, SPAN_OP, SPAN_DOMAIN, SPAN_ACTION, SPAN_MODULE} =
  SpanMetricsField;

const SPAN_FILTER_KEYS = [
  SPAN_OP,
  SPAN_DOMAIN,
  SPAN_ACTION,
  `!${SPAN_MODULE}`,
  '!span.category',
];

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

  result.push(`has:${SPAN_DESCRIPTION}`);

  if (moduleName !== ModuleName.ALL) {
    result.push(`${SPAN_MODULE}:${moduleName}`);
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
