import styled from '@emotion/styled';
import type {Location} from 'history';

import {Tooltip} from '@sentry/scraps/tooltip';

import {getNextSort} from 'sentry/components/tables/getNextSort';
import type {
  ColumnAlign,
  GridColumnHeader,
  GridColumnSort,
} from 'sentry/components/tables/gridEditable';
import {encodeSort} from 'sentry/utils/discover/eventView';
import type {Sort} from 'sentry/utils/discover/fields';
import {
  aggregateFunctionOutputType,
  fieldAlignment,
  parseFunction,
} from 'sentry/utils/discover/fields';
import type {QueryParameterNames} from 'sentry/views/insights/common/views/queryParameters';
import {SpanFields} from 'sentry/views/insights/types';

type Options = {
  column: GridColumnHeader<string>;
  sortableFields: readonly string[];
  location?: Location;
  sort?: Sort;
  sortParameterName?: QueryParameterNames | typeof DEFAULT_SORT_PARAMETER_NAME;
};

const DEFAULT_SORT_PARAMETER_NAME = 'sort';

const NUMERIC_FIELDS = new Set([
  'transaction.duration',
  SpanFields.CACHE_ITEM_SIZE,
  SpanFields.SPAN_SELF_TIME,
  SpanFields.SPAN_DURATION,
  SpanFields.CACHE_ITEM_SIZE,
  SpanFields.MESSAGING_MESSAGE_BODY_SIZE,
  SpanFields.MESSAGING_MESSAGE_RETRY_COUNT,
]);

export const getColumnSort = ({
  column,
  location,
  sort,
  sortableFields,
  sortParameterName,
}: Options): GridColumnSort => {
  const {key} = column;
  const canSort = Boolean(location && sort && sortableFields.includes(key));

  return {
    align: getAlignment(key),
    direction: canSort && sort?.field === key ? sort.kind : undefined,
    to: canSort
      ? {
          ...location,
          query: {
            ...location?.query,
            [sortParameterName ?? DEFAULT_SORT_PARAMETER_NAME]: encodeSort(
              getNextSort(key, sort)
            ),
          },
        }
      : undefined,
  };
};

export const renderHeadCell = ({column}: Pick<Options, 'column'>) =>
  column.tooltip ? (
    <StyledTooltip isHoverable showUnderline title={column.tooltip}>
      {column.name}
    </StyledTooltip>
  ) : (
    column.name
  );

export const getAlignment = (key: string): ColumnAlign => {
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

const StyledTooltip = styled(Tooltip)`
  top: 1px;
  position: relative;
`;
