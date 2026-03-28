import {useMemo} from 'react';
import {css} from '@emotion/react';
import styled from '@emotion/styled';

import {Tooltip} from '@sentry/scraps/tooltip';

import {LoadingIndicator} from 'sentry/components/loadingIndicator';
import {SimpleTable} from 'sentry/components/tables/simpleTable';
import {IconWarning} from 'sentry/icons/iconWarning';
import {t} from 'sentry/locale';
import {parseFunction} from 'sentry/utils/discover/fields';
import {prettifyTagKey} from 'sentry/utils/fields';
import {decodeColumnOrder} from 'sentry/views/discover/utils';
import {useTopEvents} from 'sentry/views/explore/hooks/useTopEvents';
import {useTraceItemAttributeKeys} from 'sentry/views/explore/hooks/useTraceItemAttributeKeys';
import {useMetricAggregatesTable} from 'sentry/views/explore/metrics/hooks/useMetricAggregatesTable';
import {
  StyledSimpleTable,
  StyledSimpleTableBody,
  StyledSimpleTableHeader,
  StyledSimpleTableHeaderCell,
  StyledSimpleTableRowCell,
  StyledTopResultsIndicator,
  TransparentLoadingMask,
} from 'sentry/views/explore/metrics/metricInfoTabs/metricInfoTabStyles';
import type {TraceMetric} from 'sentry/views/explore/metrics/metricQuery';
import {
  createTraceMetricFilter,
  getMetricsUnit,
} from 'sentry/views/explore/metrics/utils';
import {
  useQueryParamsAggregateSortBys,
  useQueryParamsGroupBys,
  useSetQueryParamsAggregateSortBys,
} from 'sentry/views/explore/queryParams/context';
import {FieldRenderer} from 'sentry/views/explore/tables/fieldRenderer';
import {TraceItemDataset} from 'sentry/views/explore/types';
import {GenericWidgetEmptyStateWarning} from 'sentry/views/performance/landing/widgets/components/selectableList';

const RESULT_LIMIT = 50;

interface AggregatesTabProps {
  traceMetric: TraceMetric;
  isMetricOptionsEmpty?: boolean;
}

export function AggregatesTab({traceMetric, isMetricOptionsEmpty}: AggregatesTabProps) {
  const topEvents = useTopEvents();

  const {result, eventView, fields} = useMetricAggregatesTable({
    enabled: Boolean(traceMetric.name) && !isMetricOptionsEmpty,
    limit: RESULT_LIMIT,
    traceMetric,
  });

  const columns = useMemo(
    () => decodeColumnOrder(eventView.fields, result.meta),
    [eventView, result.meta]
  );
  const sorts = useQueryParamsAggregateSortBys();
  const setSorts = useSetQueryParamsAggregateSortBys();
  const groupBys = useQueryParamsGroupBys();

  const traceMetricFilter = createTraceMetricFilter(traceMetric);

  const {attributes: numberTags} = useTraceItemAttributeKeys({
    traceItemType: TraceItemDataset.TRACEMETRICS,
    type: 'number',
    enabled: Boolean(traceMetricFilter),
    query: traceMetricFilter,
  });
  const {attributes: stringTags} = useTraceItemAttributeKeys({
    traceItemType: TraceItemDataset.TRACEMETRICS,
    type: 'string',
    enabled: Boolean(traceMetricFilter),
    query: traceMetricFilter,
  });
  const {attributes: booleanTags} = useTraceItemAttributeKeys({
    traceItemType: TraceItemDataset.TRACEMETRICS,
    type: 'boolean',
    enabled: Boolean(traceMetricFilter),
    query: traceMetricFilter,
  });

  const meta = result.meta ?? {};

  const groupByFieldCount = groupBys.length;
  const aggregateFieldCount = fields.length - groupByFieldCount;

  const tableStyle = useMemo(() => {
    // First aggregate column gets 1fr, pushing remaining aggregates to the right
    if (groupByFieldCount > 0 && aggregateFieldCount > 0) {
      // groupBys: auto ... auto | aggregates: 1fr auto ... auto
      const groupByColumns = `repeat(${groupByFieldCount}, auto)`;
      const aggregateColumns =
        aggregateFieldCount > 1 ? `1fr repeat(${aggregateFieldCount - 1}, auto)` : '1fr';
      return {gridTemplateColumns: `${groupByColumns} ${aggregateColumns}`};
    }
    if (aggregateFieldCount > 1) {
      // Only aggregates: 1fr auto ... auto
      return {gridTemplateColumns: `1fr repeat(${aggregateFieldCount - 1}, auto)`};
    }
    // Single column or only groupBys
    return {
      gridTemplateColumns:
        fields.length > 1 ? `repeat(${fields.length - 1}, auto) 1fr` : '1fr',
    };
  }, [aggregateFieldCount, fields.length, groupByFieldCount]);

  const firstColumnOffset = useMemo(() => {
    return groupBys.length > 0 ? '15px' : '8px';
  }, [groupBys]);

  // Dividers: between last groupBy and first aggregate, and between all aggregates
  const shouldShowDivider = (index: number) => {
    // Last groupBy before aggregates
    if (index > 0 && index < groupByFieldCount) {
      return true;
    }

    // Between aggregate columns (not the last one), we use fields here because we need the total number of columns
    if (index > groupByFieldCount && index < fields.length) {
      return true;
    }

    return false;
  };

  const isPending = result.isPending && !isMetricOptionsEmpty;

  return (
    <AggregatesSimpleTable style={tableStyle}>
      {isPending && <TransparentLoadingMask />}

      <AggregatesTableHeader>
        {fields.map((field, i) => {
          let label = field;
          const tag =
            stringTags?.[field] ?? numberTags?.[field] ?? booleanTags?.[field] ?? null;
          const func = parseFunction(field);
          if (func) {
            label = `${func.name}(…)`;
          } else if (tag) {
            label = tag.name;
          } else {
            label = prettifyTagKey(field);
          }

          const direction = sorts.find(s => s.field === field)?.kind;

          function updateSort() {
            const kind = direction === 'desc' ? 'asc' : 'desc';
            setSorts([{field, kind}]);
          }

          return (
            <AggregatesTableHeaderCell
              key={i}
              divider={shouldShowDivider(i)}
              isAggregate={Boolean(func)}
              sort={direction}
              handleSortClick={updateSort}
            >
              <Tooltip showOnlyOnOverflow title={label}>
                {label}
              </Tooltip>
            </AggregatesTableHeaderCell>
          );
        })}
      </AggregatesTableHeader>

      <AggregatesTableBody>
        {result.isError ? (
          <SimpleTable.Empty>
            <IconWarning data-test-id="error-indicator" variant="muted" size="lg" />
          </SimpleTable.Empty>
        ) : result.data?.length ? (
          result.data.map((row, i) => (
            <SimpleTable.Row key={i} style={{minHeight: '33px'}}>
              {topEvents && i < topEvents && (
                <StyledTopResultsIndicator count={topEvents} index={i} />
              )}
              {fields.map((field, j) => (
                <AggregatesRowCell
                  key={j}
                  isAggregate={Boolean(parseFunction(field))}
                  offset={j === 0 ? firstColumnOffset : undefined}
                >
                  <FieldRenderer
                    column={columns[j]}
                    data={row}
                    unit={getMetricsUnit(meta, field)}
                    meta={meta}
                    usePortalOnDropdown
                  />
                </AggregatesRowCell>
              ))}
            </SimpleTable.Row>
          ))
        ) : isPending ? (
          <SimpleTable.Empty>
            <LoadingIndicator />
          </SimpleTable.Empty>
        ) : (
          <SimpleTable.Empty>
            <GenericWidgetEmptyStateWarning title={t('No aggregates found')} message="" />
          </SimpleTable.Empty>
        )}
      </AggregatesTableBody>
    </AggregatesSimpleTable>
  );
}

const AggregatesSimpleTable = styled(StyledSimpleTable)`
  overflow: auto;
`;

const AggregatesTableBody = styled(StyledSimpleTableBody)`
  overflow: unset;
`;

const AggregatesTableHeader = styled(StyledSimpleTableHeader)`
  z-index: 2;
`;

const AggregatesTableHeaderCell = styled(StyledSimpleTableHeaderCell)<{
  isAggregate: boolean;
}>`
  justify-content: ${p => (p.isAggregate ? 'flex-end' : 'flex-start')};
  padding: ${p => (p.noPadding ? 0 : p.theme.space.lg)};
  padding-top: ${p => (p.noPadding ? 0 : p.theme.space.xs)};
  padding-bottom: ${p => (p.noPadding ? 0 : p.theme.space.xs)};
`;

const AggregatesRowCell = styled(StyledSimpleTableRowCell)<{
  isAggregate: boolean;
  offset?: string;
}>`
  ${p =>
    p.isAggregate &&
    css`
      justify-content: flex-end;
    `}
  ${p =>
    p.offset &&
    css`
      padding-left: ${p.offset};
    `}
`;
