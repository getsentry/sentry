import {Location} from 'history';

import {GridColumnHeader} from 'sentry/components/gridEditable';
import SortLink, {Alignments} from 'sentry/components/gridEditable/sortLink';
import {
  aggregateFunctionOutputType,
  AggregationOutputType,
  parseFunction,
  Sort,
} from 'sentry/utils/discover/fields';
import {SpanMetricsFields} from 'sentry/views/starfish/types';
import {QueryParameterNames} from 'sentry/views/starfish/views/queryParameters';

const rightAlignedColumns: AggregationOutputType[] = ['duration', 'integer', 'number'];

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
]);

// TODO use sort link and stuff
export const renderHeadCell = ({column, location, sort}: Options) => {
  const {key, name} = column;
  let alignment: Alignments = 'left';
  const result = parseFunction(key);
  if (result) {
    const outputType = aggregateFunctionOutputType(result.name, result.arguments[0]);
    if (outputType && rightAlignedColumns.includes(outputType)) {
      alignment = 'right';
    }
  }

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
            [QueryParameterNames.SORT]: `-${key}`,
          },
        };
      }}
    />
  );
};
