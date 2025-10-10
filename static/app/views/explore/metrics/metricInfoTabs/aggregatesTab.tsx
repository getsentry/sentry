import {useMemo, useRef} from 'react';
import styled from '@emotion/styled';

import {Flex} from '@sentry/scraps/layout';

import {Tooltip} from 'sentry/components/core/tooltip';
import EmptyStateWarning from 'sentry/components/emptyStateWarning';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import LoadingMask from 'sentry/components/loadingMask';
import type {Alignments} from 'sentry/components/tables/gridEditable/sortLink';
import {GridBodyCell, GridHeadCell} from 'sentry/components/tables/gridEditable/styles';
import {IconArrow} from 'sentry/icons/iconArrow';
import {IconWarning} from 'sentry/icons/iconWarning';
import {t} from 'sentry/locale';
import {defined} from 'sentry/utils';
import {
  fieldAlignment,
  parseFunction,
  prettifyParsedFunction,
} from 'sentry/utils/discover/fields';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import {TopResultsIndicator} from 'sentry/views/discover/table/topResultsIndicator';
import {
  TableBody,
  TableHead,
  TableRow,
  TableStatus,
  useTableStyles,
} from 'sentry/views/explore/components/table';
import {useTopEvents} from 'sentry/views/explore/hooks/useTopEvents';
import {useTraceItemAttributeKeys} from 'sentry/views/explore/hooks/useTraceItemAttributeKeys';
import {useMetricAggregatesTable} from 'sentry/views/explore/metrics/hooks/useMetricAggregatesTable';
import {Table} from 'sentry/views/explore/multiQueryMode/components/miniTable';
import {
  useQueryParamsAggregateSortBys,
  useSetQueryParamsAggregateSortBys,
} from 'sentry/views/explore/queryParams/context';
import {FieldRenderer} from 'sentry/views/explore/tables/fieldRenderer';
import {TraceItemDataset} from 'sentry/views/explore/types';

const TABLE_HEIGHT = 230;
const RESULT_LIMIT = 50;

interface AggregatesTabProps {
  metricName: string;
}

export function AggregatesTab({metricName}: AggregatesTabProps) {
  const topEvents = useTopEvents();

  const {result, eventView, fields} = useMetricAggregatesTable({
    enabled: Boolean(metricName),
    limit: RESULT_LIMIT,
    metricName,
  });

  const columns = useMemo(() => eventView.getColumns(), [eventView]);
  const sorts = useQueryParamsAggregateSortBys();
  const setSorts = useSetQueryParamsAggregateSortBys();

  const metricNameFilter = metricName
    ? MutableSearch.fromQueryObject({['metric.name']: [metricName]}).formatString()
    : undefined;

  const {attributes: numberTags} = useTraceItemAttributeKeys({
    traceItemType: TraceItemDataset.TRACEMETRICS,
    type: 'number',
    enabled: Boolean(metricNameFilter),
    query: metricNameFilter,
  });
  const {attributes: stringTags} = useTraceItemAttributeKeys({
    traceItemType: TraceItemDataset.TRACEMETRICS,
    type: 'string',
    enabled: Boolean(metricNameFilter),
    query: metricNameFilter,
  });

  const tableRef = useRef<HTMLTableElement>(null);
  const {initialTableStyles} = useTableStyles(fields, tableRef, {
    minimumColumnWidth: 50,
  });

  const meta = result.meta ?? {};

  return (
    <TableContainer>
      {result.isPending && <TransparentLoadingMask />}
      <Table ref={tableRef} style={initialTableStyles} scrollable height={TABLE_HEIGHT}>
        <TableHead>
          <TableRow>
            {fields.map((field, i) => {
              let label = field;
              const fieldType = meta.fields?.[field];
              const align = fieldAlignment(field, fieldType);
              const tag = stringTags?.[field] ?? numberTags?.[field] ?? null;
              if (tag) {
                label = tag.name;
              }

              const func = parseFunction(field);
              if (func) {
                label = prettifyParsedFunction(func);
              }

              const direction = sorts.find(s => s.field === field)?.kind;

              function updateSort() {
                const kind = direction === 'desc' ? 'asc' : 'desc';
                setSorts([{field, kind}]);
              }

              return (
                <TableHeadCell align={align} key={i} isFirst={i === 0}>
                  <TableHeadCellContent align="center" gap="sm" onClick={updateSort}>
                    <Tooltip showOnlyOnOverflow title={label}>
                      {label}
                    </Tooltip>
                    {defined(direction) && (
                      <IconArrow
                        size="xs"
                        direction={
                          direction === 'desc'
                            ? 'down'
                            : direction === 'asc'
                              ? 'up'
                              : undefined
                        }
                      />
                    )}
                  </TableHeadCellContent>
                </TableHeadCell>
              );
            })}
          </TableRow>
        </TableHead>
        <TableBody>
          {result.isError ? (
            <TableStatus>
              <IconWarning data-test-id="error-indicator" color="gray300" size="lg" />
            </TableStatus>
          ) : result.data?.length ? (
            result.data.map((row, i) => {
              return (
                <TableRow key={i}>
                  {topEvents && i < topEvents && (
                    <StyledTopResultsIndicator count={topEvents} index={i} />
                  )}
                  {fields.map((field, j) => {
                    return (
                      <StyledTableBodyCell key={j}>
                        <FieldRenderer
                          column={columns[j]}
                          data={row}
                          unit={meta?.units?.[field]}
                          meta={meta}
                        />
                      </StyledTableBodyCell>
                    );
                  })}
                </TableRow>
              );
            })
          ) : result.isPending ? (
            <TableStatus>
              <LoadingIndicator />
            </TableStatus>
          ) : (
            <TableStatus>
              <EmptyStateWarning>
                <p>{t('No aggregates found')}</p>
              </EmptyStateWarning>
            </TableStatus>
          )}
        </TableBody>
      </Table>
    </TableContainer>
  );
}

const TableContainer = styled('div')`
  position: relative;
`;

const StyledTableBodyCell = styled(GridBodyCell)`
  font-size: ${p => p.theme.fontSize.sm};
  min-height: 12px;
`;

const TableHeadCell = styled(GridHeadCell)<{align?: Alignments}>`
  ${p => p.align && `justify-content: ${p.align};`}
  font-size: ${p => p.theme.fontSize.sm};
  height: 33px;
`;

const TableHeadCellContent = styled(Flex)`
  cursor: pointer;
  user-select: none;
`;

const TransparentLoadingMask = styled(LoadingMask)`
  opacity: 0.4;
  z-index: 1;
`;

const StyledTopResultsIndicator = styled(TopResultsIndicator)`
  margin-top: 9.5px;
`;
