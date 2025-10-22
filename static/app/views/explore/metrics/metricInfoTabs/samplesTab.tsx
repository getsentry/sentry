import {useMemo, useRef} from 'react';
import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';

import {Flex} from '@sentry/scraps/layout';

import {Link} from 'sentry/components/core/link';
import {Tooltip} from 'sentry/components/core/tooltip';
import EmptyStateWarning from 'sentry/components/emptyStateWarning';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import LoadingMask from 'sentry/components/loadingMask';
import type {Alignments} from 'sentry/components/tables/gridEditable/sortLink';
import {GridBodyCell, GridHeadCell} from 'sentry/components/tables/gridEditable/styles';
import {IconFire, IconSpan, IconTerminal} from 'sentry/icons';
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
import {LogAttributesRendererMap} from 'sentry/views/explore/logs/fieldRenderers';
import {getLogColors} from 'sentry/views/explore/logs/styles';
import {OurLogKnownFieldKey} from 'sentry/views/explore/logs/types';
import {SeverityLevel} from 'sentry/views/explore/logs/utils';
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
const TWO_MINUTE_DELAY = 120;

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
    fields: ['timestamp', 'value', 'trace'],
    ingestionDelaySeconds: TWO_MINUTE_DELAY,
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

  const theme = useTheme();

  const renderTraceCell = (row: any, traceId: string, telemetry: any) => {
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
      <Flex gap="xs" display="inline-flex">
        <Link to={target} style={{minWidth: '66px'}}>
          {getShortEventId(traceId)}
        </Link>
        <Flex gap="xs" style={{color: theme.red300}}>
          <IconFire />
          {telemetry?.errorsCount ?? 0}
        </Flex>
        <Flex gap="xs" style={{color: theme.purple400}}>
          <IconTerminal />
          {telemetry?.logsCount ?? 0}
        </Flex>
        <Flex gap="xs" style={{color: theme.gray300}}>
          <IconSpan color="gray300" />
          {telemetry?.spansCount ?? 0}
        </Flex>
      </Flex>
    );
  };

  const renderTimestampCell = (field: string, row: any, originalFieldIndex: number) => {
    const customRenderer = LogAttributesRendererMap[OurLogKnownFieldKey.TIMESTAMP];

    if (!customRenderer) {
      return (
        <FieldRenderer
          column={columns[originalFieldIndex]}
          data={row}
          unit={meta?.units?.[field]}
          meta={meta}
        />
      );
    }

    return customRenderer({
      item: {
        fieldKey: field,
        value: row[field],
      },
      extra: {
        attributes: row,
        attributeTypes: meta.fields ?? {},
        highlightTerms: [],
        logColors: getLogColors(SeverityLevel.INFO, theme),
        location,
        organization,
        theme,
      },
    });
  };

  const renderDefaultCell = (field: string, row: any, originalFieldIndex: number) => {
    return (
      <FieldRenderer
        column={columns[originalFieldIndex]}
        data={row}
        unit={meta?.units?.[field]}
        meta={meta}
      />
    );
  };

  const renderFieldCell = (field: string, row: any, traceId: string, telemetry: any) => {
    const originalFieldIndex = fields.indexOf(field);

    if (originalFieldIndex === -1) {
      return null;
    }

    switch (field) {
      case 'trace':
        return renderTraceCell(row, traceId, telemetry);
      case 'timestamp':
        return renderTimestampCell(field, row, originalFieldIndex);
      default:
        return renderDefaultCell(field, row, originalFieldIndex);
    }
  };

  return (
    <TableContainer>
      {(result.isPending || isTelemetryLoading) && <TransparentLoadingMask />}
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
              const traceId = row.trace as string;
              const telemetry = telemetryData.get(traceId);

              return (
                <TableRow key={i}>
                  {fields.map((field, j) => (
                    <StyledTableBodyCell key={j}>
                      {renderFieldCell(field, row, traceId, telemetry)}
                    </StyledTableBodyCell>
                  ))}
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
