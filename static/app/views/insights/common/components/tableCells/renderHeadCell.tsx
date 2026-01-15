import styled from '@emotion/styled';
import type {Location} from 'history';

import {Tooltip} from 'sentry/components/core/tooltip';
import type {GridColumnHeader} from 'sentry/components/tables/gridEditable';
import type {Alignments} from 'sentry/components/tables/gridEditable/sortLink';
import SortLink from 'sentry/components/tables/gridEditable/sortLink';
import type {Sort} from 'sentry/utils/discover/fields';
import {
  aggregateFunctionOutputType,
  fieldAlignment,
  parseFunction,
} from 'sentry/utils/discover/fields';
import type {QueryParameterNames} from 'sentry/views/insights/common/views/queryParameters';
import {SpanFields, SpanFunction} from 'sentry/views/insights/types';

type Options = {
  column: GridColumnHeader<string>;
  location?: Location;
  sort?: Sort;
  sortParameterName?: QueryParameterNames | typeof DEFAULT_SORT_PARAMETER_NAME;
};

const DEFAULT_SORT_PARAMETER_NAME = 'sort';

const {SPAN_SELF_TIME, SPAN_DURATION, HTTP_RESPONSE_CONTENT_LENGTH, CACHE_ITEM_SIZE} =
  SpanFields;
const {
  TIME_SPENT_PERCENTAGE,
  EPM,
  TPM,
  HTTP_RESPONSE_COUNT,
  HTTP_RESPONSE_RATE,
  CACHE_HIT_RATE,
  CACHE_MISS_RATE,
} = SpanFunction;

const SORTABLE_FIELDS = new Set([
  `avg(${SPAN_SELF_TIME})`,
  `avg(${SPAN_DURATION})`,
  `sum(${SPAN_DURATION})`,
  `sum(${SPAN_SELF_TIME})`,
  `p95(${SPAN_SELF_TIME})`,
  `p75(transaction.duration)`,
  `transaction.duration`,
  'transaction',
  `count()`,
  `${EPM}()`,
  `${TPM}()`,
  `${TIME_SPENT_PERCENTAGE}()`,
  `${HTTP_RESPONSE_COUNT}(5)`,
  `${HTTP_RESPONSE_COUNT}(4)`,
  `${HTTP_RESPONSE_COUNT}(3)`,
  `${HTTP_RESPONSE_COUNT}(2)`,
  `${HTTP_RESPONSE_RATE}(5)`,
  `${HTTP_RESPONSE_RATE}(4)`,
  `${HTTP_RESPONSE_RATE}(3)`,
  `${HTTP_RESPONSE_RATE}(2)`,
  `avg(${HTTP_RESPONSE_CONTENT_LENGTH})`,
  `${CACHE_HIT_RATE}()`,
  `${CACHE_MISS_RATE}()`,
  SpanFields.TIMESTAMP,
  SpanFields.SPAN_DURATION,
  `avg(${CACHE_ITEM_SIZE})`,
  SpanFields.MESSAGING_MESSAGE_DESTINATION_NAME,
  'count_op(queue.publish)',
  'count_op(queue.process)',
  'avg_if(span.duration,span.op,equals,queue.process)',
  'avg(messaging.message.receive.latency)',
  'time_spent_percentage(span.duration)',
  'transaction',
  'request.method',
  'span.op',
  'project',
  'epm()',
  'p50(span.duration)',
  'p95(span.duration)',
  'failure_rate()',
  'performance_score(measurements.score.total)',
  'count_unique(user)',
  'p50_if(span.duration,is_transaction,equals,true)',
  'p75_if(span.duration,is_transaction,equals,true)',
  'p90_if(span.duration,is_transaction,equals,true)',
  'p95_if(span.duration,is_transaction,equals,true)',
  'p99_if(span.duration,is_transaction,equals,true)',
  'failure_rate_if(is_transaction,equals,true)',
  'sum_if(span.duration,is_transaction,equals,true)',
  'p75(measurements.frames_slow_rate)',
  'p75(measurements.frames_frozen_rate)',
  'trace_status_rate(ok)',
]);

const NUMERIC_FIELDS = new Set([
  'transaction.duration',
  SpanFields.CACHE_ITEM_SIZE,
  SpanFields.SPAN_SELF_TIME,
  SpanFields.SPAN_DURATION,
  SpanFields.CACHE_ITEM_SIZE,
  SpanFields.MESSAGING_MESSAGE_BODY_SIZE,
  SpanFields.MESSAGING_MESSAGE_RETRY_COUNT,
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

  const hasTooltip = column.tooltip;

  const sortLink = (
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

  if (hasTooltip) {
    const AlignmentContainer = alignment === 'right' ? AlignRight : AlignLeft;

    return (
      <AlignmentContainer>
        <StyledTooltip isHoverable showUnderline title={column.tooltip}>
          {sortLink}
        </StyledTooltip>
      </AlignmentContainer>
    );
  }

  return sortLink;
};

const getAlignment = (key: string): Alignments => {
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

const AlignLeft = styled('span')`
  display: block;
  margin: auto;
  text-align: left;
  width: 100%;
`;

const AlignRight = styled('span')`
  display: block;
  margin: auto;
  text-align: right;
  width: 100%;
`;

const StyledTooltip = styled(Tooltip)`
  top: 1px;
  position: relative;
`;
