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
import {SpanFunction, SpanMetricsField} from 'sentry/views/starfish/types';
import type {QueryParameterNames} from 'sentry/views/starfish/views/queryParameters';

type Options = {
  column: GridColumnHeader<string>;
  location?: Location;
  sort?: Sort;
  sortParameterName?:
    | QueryParameterNames.ENDPOINTS_SORT
    | QueryParameterNames.SPANS_SORT
    | QueryParameterNames.DOMAINS_SORT
    | typeof DEFAULT_SORT_PARAMETER_NAME;
};

const DEFAULT_SORT_PARAMETER_NAME = 'sort';

const {SPAN_SELF_TIME, HTTP_RESPONSE_CONTENT_LENGTH} = SpanMetricsField;
const {TIME_SPENT_PERCENTAGE, SPS, SPM, HTTP_ERROR_COUNT, HTTP_RESPONSE_RATE} =
  SpanFunction;

export const SORTABLE_FIELDS = new Set([
  `avg(${SPAN_SELF_TIME})`,
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
  }
  return 'left';
};
