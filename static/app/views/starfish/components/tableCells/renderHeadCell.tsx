import {Location} from 'history';

import {GridColumnHeader} from 'sentry/components/gridEditable';
import SortLink, {Alignments} from 'sentry/components/gridEditable/sortLink';
import {
  aggregateFunctionOutputType,
  fieldAlignment,
  parseFunction,
  Sort,
} from 'sentry/utils/discover/fields';
import {SpanMetricsFields} from 'sentry/views/starfish/types';
import {QueryParameterNames} from 'sentry/views/starfish/views/queryParameters';

type Options = {
  column: GridColumnHeader<string>;
  location?: Location;
  sort?: Sort;
};

const {SPAN_SELF_TIME} = SpanMetricsFields;

export const SORTABLE_FIELDS = new Set([
  `p95(${SPAN_SELF_TIME})`,
  `percentile_percent_change(${SPAN_SELF_TIME}, 0.95)`,
  'sps()',
  'sps_percent_change()',
  'time_spent_percentage()',
  'time_spent_percentage(local)',
  'http_error_count()',
  'http_error_count_percent_change()',
]);

export const renderHeadCell = ({column, location, sort}: Options) => {
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
            [QueryParameterNames.SORT]: newSort,
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
