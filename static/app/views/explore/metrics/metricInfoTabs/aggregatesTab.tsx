import {useMemo} from 'react';
import {css, useTheme} from '@emotion/react';
import styled from '@emotion/styled';
import {useQuery} from '@tanstack/react-query';

import {Tooltip} from '@sentry/scraps/tooltip';

import {LoadingIndicator} from 'sentry/components/loadingIndicator';
import {usePageFilters} from 'sentry/components/pageFilters/usePageFilters';
import {COL_WIDTH_UNDEFINED} from 'sentry/components/tables/gridEditable';
import {SimpleTable} from 'sentry/components/tables/simpleTable';
import {IconWarning} from 'sentry/icons/iconWarning';
import {t} from 'sentry/locale';
import {isEquation, parseFunction} from 'sentry/utils/discover/fields';
import {prettifyTagKey} from 'sentry/utils/fields';
import {useOrganization} from 'sentry/utils/useOrganization';
import type {TableColumn} from 'sentry/views/discover/table/types';
import {decodeColumnOrder} from 'sentry/views/discover/utils';
import {EXPLORE_FIVE_MIN_STALE_TIME} from 'sentry/views/explore/constants';
import {useTopEvents} from 'sentry/views/explore/hooks/useTopEvents';
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
import {useMetricVisualize} from 'sentry/views/explore/metrics/metricsQueryParams';
import {TraceMetricKnownFieldKey} from 'sentry/views/explore/metrics/types';
import {
  createTraceMetricFilter,
  getMetricsUnit,
} from 'sentry/views/explore/metrics/utils';
import {
  useQueryParamsAggregateSortBys,
  useQueryParamsGroupBys,
  useSetQueryParamsAggregateSortBys,
} from 'sentry/views/explore/queryParams/context';
import {
  isVisualizeEquation,
  isVisualizeFunction,
} from 'sentry/views/explore/queryParams/visualize';
import {FieldRenderer} from 'sentry/views/explore/tables/fieldRenderer';
import {TraceItemDataset} from 'sentry/views/explore/types';
import {
  selectTraceItemTagCollection,
  traceItemAttributeKeysOptions,
} from 'sentry/views/explore/utils/traceItemAttributeKeysOptions';
import {GenericWidgetEmptyStateWarning} from 'sentry/views/performance/landing/widgets/components/selectableList';

const RESULT_LIMIT = 50;

const METRIC_NAME_COLUMN: TableColumn<string> = {
  key: TraceMetricKnownFieldKey.METRIC_NAME,
  name: TraceMetricKnownFieldKey.METRIC_NAME,
  type: 'string',
  isSortable: false,
  column: {
    kind: 'field',
    field: TraceMetricKnownFieldKey.METRIC_NAME,
  },
  width: COL_WIDTH_UNDEFINED,
};

interface AggregatesTabProps {
  traceMetric: TraceMetric;
  isMetricOptionsEmpty?: boolean;
}

export function AggregatesTab({traceMetric, isMetricOptionsEmpty}: AggregatesTabProps) {
  const theme = useTheme();
  const {selection} = usePageFilters();
  const organization = useOrganization();
  const topEvents = useTopEvents();
  const visualize = useMetricVisualize();

  const {result, eventView, fields} = useMetricAggregatesTable({
    enabled: isVisualizeFunction(visualize)
      ? Boolean(traceMetric.name) && !isMetricOptionsEmpty
      : isVisualizeEquation(visualize) && Boolean(visualize.expression.text),
    limit: RESULT_LIMIT,
    traceMetric,
    staleTime: EXPLORE_FIVE_MIN_STALE_TIME,
  });

  const columns = useMemo(
    () => decodeColumnOrder(eventView.fields, result.meta),
    [eventView, result.meta]
  );
  const sorts = useQueryParamsAggregateSortBys();
  const setSorts = useSetQueryParamsAggregateSortBys();
  const groupBys = useQueryParamsGroupBys();

  const traceMetricFilter = createTraceMetricFilter(traceMetric);

  const {data} = useQuery({
    ...traceItemAttributeKeysOptions({
      organization,
      selection,
      traceItemType: TraceItemDataset.TRACEMETRICS,
      query: traceMetricFilter,
      staleTime: EXPLORE_FIVE_MIN_STALE_TIME,
    }),
    enabled: Boolean(traceMetricFilter),
    select: selectTraceItemTagCollection(),
  });

  const meta = result.meta ?? {};

  // When no group bys are selected, prepend the metric name as a virtual group-by column
  const displayFields = useMemo(() => {
    if (groupBys.length === 0 && isVisualizeFunction(visualize)) {
      return [TraceMetricKnownFieldKey.METRIC_NAME, ...fields];
    }
    return fields;
  }, [groupBys.length, fields, visualize]);

  const displayColumns = useMemo(() => {
    if (groupBys.length === 0 && isVisualizeFunction(visualize)) {
      return [METRIC_NAME_COLUMN, ...columns];
    }
    return columns;
  }, [groupBys.length, columns, visualize]);

  // Include the virtual metric name column in the group-by count so grid/divider logic works
  const groupByFieldCount =
    groupBys.length === 0 && isVisualizeFunction(visualize) ? 1 : groupBys.length;
  const aggregateFieldCount = displayFields.length - groupByFieldCount;

  const tableStyle = useMemo(() => {
    // First aggregate column gets 1fr, pushing remaining aggregates to the right
    if (groupByFieldCount > 0 && aggregateFieldCount > 0) {
      // groupBys: auto ... auto | aggregates: 1fr auto ... auto
      const groupByColumns = `repeat(${groupByFieldCount}, auto)`;
      const aggregateColumns =
        aggregateFieldCount > 1 ? `1fr repeat(${aggregateFieldCount - 1}, auto)` : '1fr';
      return {gridTemplateColumns: `${groupByColumns} ${aggregateColumns}`};
    }
    // Single column or only groupBys
    return {
      gridTemplateColumns:
        displayFields.length > 1
          ? `repeat(${displayFields.length - 1}, auto) 1fr`
          : '1fr',
    };
  }, [aggregateFieldCount, displayFields.length, groupByFieldCount]);

  const firstColumnOffset = useMemo(() => {
    return groupBys.length > 0 ? '15px' : theme.space.lg;
  }, [groupBys, theme.space.lg]);

  // Dividers: between last groupBy and first aggregate, and between all aggregates
  const shouldShowDivider = (index: number) => {
    // Last groupBy before aggregates
    if (index > 0 && index < groupByFieldCount) {
      return true;
    }

    // Between aggregate columns (not the last one)
    if (index > groupByFieldCount && index < displayFields.length) {
      return true;
    }

    return false;
  };

  const isPending = result.isPending && !isMetricOptionsEmpty;

  return (
    <AggregatesSimpleTable style={tableStyle}>
      {isPending && <TransparentLoadingMask />}

      <AggregatesStyledHeader>
        {displayFields.map((field, i) => {
          let label = field;
          const tag =
            data?.stringAttributes?.[field] ??
            data?.numberAttributes?.[field] ??
            data?.booleanAttributes?.[field] ??
            null;
          const func = parseFunction(field);
          if (field === TraceMetricKnownFieldKey.METRIC_NAME) {
            label = t('Metric');
          } else if (func) {
            label = `${func.name}(…)`;
          } else if (tag) {
            label = tag.name;
          } else if (isEquation(field)) {
            // TODO: This should say the reference format of equations
            label = t('Result');
          } else {
            label = prettifyTagKey(field);
          }

          const direction = sorts.find(s => s.field === field)?.kind;
          const canSort = field !== TraceMetricKnownFieldKey.METRIC_NAME;

          function updateSort() {
            const kind = direction === 'desc' ? 'asc' : 'desc';
            setSorts([{field, kind}]);
          }

          return (
            <AggregatesStyledHeaderCell
              key={i}
              divider={shouldShowDivider(i)}
              isAggregate={
                Boolean(func) || (isVisualizeEquation(visualize) && isEquation(field))
              }
              sort={direction}
              handleSortClick={canSort ? updateSort : undefined}
            >
              <Tooltip showOnlyOnOverflow title={label}>
                {label}
              </Tooltip>
            </AggregatesStyledHeaderCell>
          );
        })}
      </AggregatesStyledHeader>

      <AggregatesTableBody>
        {result.isError ? (
          <SimpleTable.Empty>
            <IconWarning data-test-id="error-indicator" variant="muted" size="lg" />
          </SimpleTable.Empty>
        ) : result.data?.length ? (
          result.data.map((row, i) => {
            const displayRow =
              groupBys.length === 0
                ? {...row, [TraceMetricKnownFieldKey.METRIC_NAME]: traceMetric.name}
                : row;

            return (
              <SimpleTable.Row key={i} style={{minHeight: '33px'}}>
                {topEvents && i < topEvents && (
                  <StyledTopResultsIndicator count={topEvents} index={i} />
                )}
                {displayFields.map((field, j) => (
                  <AggregatesStyledRowCell
                    key={j}
                    isAggregate={Boolean(parseFunction(field))}
                    offset={j === 0 ? firstColumnOffset : undefined}
                  >
                    <FieldRenderer
                      column={displayColumns.find(column => column.key === field)}
                      data={displayRow}
                      unit={getMetricsUnit(meta, field)}
                      meta={meta}
                      usePortalOnDropdown
                    />
                  </AggregatesStyledRowCell>
                ))}
              </SimpleTable.Row>
            );
          })
        ) : isPending ? (
          <SimpleTable.Empty>
            <LoadingIndicator size={40} style={{margin: '1em 1em'}} />
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
  overflow-x: auto;
  overflow-y: hidden;
`;

const AggregatesTableBody = styled(StyledSimpleTableBody)`
  overflow-x: hidden;
  overflow-y: auto;
`;

const AggregatesStyledHeader = styled(StyledSimpleTableHeader)`
  z-index: 2;
`;

const AggregatesStyledHeaderCell = styled(StyledSimpleTableHeaderCell)<{
  isAggregate: boolean;
}>`
  justify-content: ${p => (p.isAggregate ? 'flex-end' : 'flex-start')};
  padding: ${p => (p.noPadding ? 0 : p.theme.space.lg)};
  padding-top: ${p => (p.noPadding ? 0 : p.theme.space.xs)};
  padding-bottom: ${p => (p.noPadding ? 0 : p.theme.space.xs)};
`;

const AggregatesStyledRowCell = styled(StyledSimpleTableRowCell)<{
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
