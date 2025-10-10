import {useMemo, useRef} from 'react';
import styled from '@emotion/styled';

import {Flex} from '@sentry/scraps/layout';

import {Link} from 'sentry/components/core/link';
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
import {fieldAlignment} from 'sentry/utils/discover/fields';
import {getShortEventId} from 'sentry/utils/events';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';
import {
  TableBody,
  TableHead,
  TableRow,
  TableStatus,
  useTableStyles,
} from 'sentry/views/explore/components/table';
import {useMetricSamplesTable} from 'sentry/views/explore/metrics/hooks/useMetricSamplesTable';
import {Table} from 'sentry/views/explore/multiQueryMode/components/miniTable';
import {
  useQueryParamsSortBys,
  useSetQueryParamsSortBys,
} from 'sentry/views/explore/queryParams/context';
import {FieldRenderer} from 'sentry/views/explore/tables/fieldRenderer';
import {TraceViewSources} from 'sentry/views/performance/newTraceDetails/traceHeader/breadcrumbs';
import {getTraceDetailsUrl} from 'sentry/views/performance/traceDetails/utils';

const TABLE_HEIGHT = 230;
const RESULT_LIMIT = 50;

interface SamplesTabProps {
  metricName: string;
}

export function SamplesTab({metricName}: SamplesTabProps) {
  const organization = useOrganization();
  const location = useLocation();
  const {selection} = usePageFilters();

  const {result, eventView, fields} = useMetricSamplesTable({
    enabled: Boolean(metricName),
    limit: RESULT_LIMIT,
    metricName,
    fields: ['timestamp', 'trace', 'value'],
  });

  const columns = useMemo(() => eventView.getColumns(), [eventView]);
  const sorts = useQueryParamsSortBys();
  const setSorts = useSetQueryParamsSortBys();

  const tableRef = useRef<HTMLTableElement>(null);
  const {initialTableStyles} = useTableStyles(fields, tableRef, {
    minimumColumnWidth: 50,
  });

  const meta = result.meta ?? {};

  const fieldLabels: Record<string, string> = {
    trace: t('Trace'),
    value: t('Value'),
    timestamp: t('Timestamp'),
  };

  return (
    <TableContainer>
      {result.isPending && <TransparentLoadingMask />}
      <Table ref={tableRef} style={initialTableStyles} scrollable height={TABLE_HEIGHT}>
        <TableHead>
          <TableRow>
            {fields.map((field, i) => {
              const label = fieldLabels[field] ?? field;
              const fieldType = meta.fields?.[field];
              const align = fieldAlignment(field, fieldType);

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
                  {fields.map((field, j) => {
                    if (field === 'trace') {
                      const traceId = row.trace as string;
                      const timestamp = row.timestamp as number;
                      const target = getTraceDetailsUrl({
                        organization,
                        traceSlug: traceId,
                        dateSelection: {
                          start: selection.datetime.start,
                          end: selection.datetime.end,
                          statsPeriod: selection.datetime.period,
                        },
                        timestamp: timestamp / 1000,
                        location,
                        source: TraceViewSources.TRACES,
                      });

                      return (
                        <StyledTableBodyCell key={j}>
                          <Link to={target} style={{minWidth: '66px'}}>
                            {getShortEventId(traceId)}
                          </Link>
                        </StyledTableBodyCell>
                      );
                    }
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
                <p>{t('No samples found')}</p>
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
