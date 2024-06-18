import type {Location} from 'history';

import type {GridColumnHeader} from 'sentry/components/gridEditable';
import type {Alignments} from 'sentry/components/gridEditable/sortLink';
import SortLink from 'sentry/components/gridEditable/sortLink';
import type {Sort} from 'sentry/utils/discover/fields';
import {
  aggregateFunctionOutputType,
  fieldAlignment,
  parseFunction,
} from 'sentry/utils/discover/fields';
import type {QueryParameterNames} from 'sentry/views/insights/common/views/queryParameters';
import {
  SpanFunction,
  SpanIndexedField,
  SpanMetricsField,
} from 'sentry/views/insights/types';

type Options = {
  column: GridColumnHeader<string>;
  location?: Location;
  sort?: Sort;
  sortParameterName?: QueryParameterNames | typeof DEFAULT_SORT_PARAMETER_NAME;
};

const DEFAULT_SORT_PARAMETER_NAME = 'sort';

const {SPAN_SELF_TIME, SPAN_DURATION, HTTP_RESPONSE_CONTENT_LENGTH, CACHE_ITEM_SIZE} =
  SpanMetricsField;
const {
  TIME_SPENT_PERCENTAGE,
  SPS,
  SPM,
  HTTP_ERROR_COUNT,
  HTTP_RESPONSE_RATE,
  CACHE_HIT_RATE,
  CACHE_MISS_RATE,
} = SpanFunction;

export const SORTABLE_FIELDS = new Set([
  `avg(${SPAN_SELF_TIME})`,
  `avg(${SPAN_DURATION})`,
  `sum(${SPAN_SELF_TIME})`,
  `p95(${SPAN_SELF_TIME})`,
  `p75(transaction.duration)`,
  `transaction.duration`,
  'transaction',
  `count()`,
  `${SPS}()`,
  `${SPM}()`,
  `${TIME_SPENT_PERCENTAGE}()`,
  `${HTTP_ERROR_COUNT}()`,
  `${HTTP_RESPONSE_RATE}(2)`,
  `${HTTP_RESPONSE_RATE}(4)`,
  `${HTTP_RESPONSE_RATE}(5)`,
  `avg(${HTTP_RESPONSE_CONTENT_LENGTH})`,
  `${CACHE_HIT_RATE}()`,
  `${CACHE_MISS_RATE}()`,
  SpanIndexedField.TIMESTAMP,
  SpanIndexedField.SPAN_DURATION,
  `avg(${CACHE_ITEM_SIZE})`,
  SpanIndexedField.MESSAGING_MESSAGE_DESTINATION_NAME,
  'count_op(queue.publish)',
  'count_op(queue.process)',
  'avg_if(span.duration,span.op,queue.process)',
  'avg(messaging.message.receive.latency)',
  'time_spent_percentage(app,span.duration)',
]);

const NUMERIC_FIELDS = new Set([
  'transaction.duration',
  SpanMetricsField.CACHE_ITEM_SIZE,
  SpanIndexedField.SPAN_SELF_TIME,
  SpanIndexedField.SPAN_DURATION,
  SpanIndexedField.CACHE_ITEM_SIZE,
  SpanIndexedField.MESSAGING_MESSAGE_BODY_SIZE,
  SpanIndexedField.MESSAGING_MESSAGE_RETRY_COUNT,
]);

export const renderHeadCell = ({column, location, sort, sortParameterName}: Options) => {
  const {key, name} = column;
  const alignment = getAlignment(key);

  let newSortDirection: Sort['kind'] = 'desc';
  if (sort?.field === column.key) {
    if (sort.kind === 'desc') {
      newSortDirection = 'asc';
    }
  }

  const newSort = `${newSortDirection === 'desc' ? '-' : ''}${key}`;

  return (
    <SortLink
      align={alignment}
      canSort={Boolean(location && sort && SORTABLE_FIELDS.has(key))}
      direction={sort?.field === column.key ? sort.kind : undefined}
      title={name}
      generateSortLink={() => {
        return {
          ...location,
          query: {
            ...location?.query,
            [sortParameterName ?? DEFAULT_SORT_PARAMETER_NAME]: newSort,
          },
        };
      }}
    />
  );
};

export const getAlignment = (key: string): Alignments => {
  const result = parseFunction(key);

  if (result) {
    const outputType = aggregateFunctionOutputType(result.name, result.arguments[0]);

    if (outputType) {
      return fieldAlignment(key, outputType);
    }
  } else {
    if (NUMERIC_FIELDS.has(key)) {
      return 'right';
    }
  }
  return 'left';
};
