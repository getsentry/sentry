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
import {useTraceTelemetry} from 'sentry/views/explore/metrics/hooks/useTraceTelemetry';
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

  // Extract trace IDs from the result
  const traceIds = useMemo(() => {
    if (!result.data) {
      return [];
    }
    return result.data.map(row => row.trace as string).filter(Boolean);
  }, [result.data]);

  // Fetch telemetry data for traces
  const {data: telemetryData, isLoading: isTelemetryLoading} = useTraceTelemetry({
    enabled: Boolean(metricName) && traceIds.length > 0,
    traceIds,
  });

  const columns = useMemo(() => eventView.getColumns(), [eventView]);
  const sorts = useQueryParamsSortBys();
  const setSorts = useSetQueryParamsSortBys();

  // Add telemetry columns to the fields list
  const displayFields = useMemo(() => {
    return [...fields, 'logs', 'spans'];
  }, [fields]);

  const tableRef = useRef<HTMLTableElement>(null);
  const {initialTableStyles} = useTableStyles(displayFields, tableRef, {
    minimumColumnWidth: 50,
  });

  const meta = result.meta ?? {};

  const fieldLabels: Record<string, string> = {
    trace: t('Trace'),
    value: t('Value'),
    timestamp: t('Timestamp'),
    logs: t('Logs'),
    spans: t('Spans'),
  };

  return (
    <TableContainer>
      {(result.isPending || isTelemetryLoading) && <TransparentLoadingMask />}
      <Table ref={tableRef} style={initialTableStyles} scrollable height={TABLE_HEIGHT}>
        <TableHead>
          <TableRow>
            {displayFields.map((field, i) => {
              const label = fieldLabels[field] ?? field;
              const fieldType = meta.fields?.[field];
              const align = fieldAlignment(field, fieldType);

              // Don't allow sorting on telemetry fields
              const isTelemetryField = field === 'logs' || field === 'spans';
              const direction = isTelemetryField
                ? undefined
                : sorts.find(s => s.field === field)?.kind;

              function updateSort() {
                if (isTelemetryField) {
                  return;
                }
                const kind = direction === 'desc' ? 'asc' : 'desc';
                setSorts([{field, kind}]);
              }

              return (
                <TableHeadCell align={align} key={i} isFirst={i === 0}>
                  <TableHeadCellContent
                    align="center"
                    gap="sm"
                    onClick={updateSort}
                    style={isTelemetryField ? {cursor: 'default'} : undefined}
                  >
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
              const traceId = row.trace as string;
              const telemetry = telemetryData.get(traceId);

              return (
                <TableRow key={i}>
                  {displayFields.map((field, j) => {
                    if (field === 'trace') {
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

                    if (field === 'logs') {
                      return (
                        <StyledTableBodyCell key={j} align="right">
                          {telemetry?.logsCount ?? 0}
                        </StyledTableBodyCell>
                      );
                    }

                    if (field === 'spans') {
                      return (
                        <StyledTableBodyCell key={j} align="right">
                          {telemetry?.spansCount ?? 0}
                        </StyledTableBodyCell>
                      );
                    }

                    // Find the index in original fields array
                    const originalFieldIndex = fields.indexOf(field);
                    if (originalFieldIndex === -1) {
                      return null;
                    }

                    return (
                      <StyledTableBodyCell key={j}>
                        <FieldRenderer
                          column={columns[originalFieldIndex]}
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

const StyledTableBodyCell = styled(GridBodyCell)<{align?: Alignments}>`
  font-size: ${p => p.theme.fontSize.sm};
  min-height: 12px;
  ${p => p.align && `justify-content: ${p.align};`}
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
