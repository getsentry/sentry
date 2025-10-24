import {Fragment, useMemo, useRef, useState} from 'react';
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
import {IconChevron, IconFire, IconSpan, IconTerminal} from 'sentry/icons';
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
  Table,
  TableBody,
  TableHead,
  TableHeadCellContent,
  TableRow,
  TableStatus,
  useTableStyles,
} from 'sentry/views/explore/components/table';
import {LogAttributesRendererMap} from 'sentry/views/explore/logs/fieldRenderers';
import {
  FirstTableHeadCell,
  getLogColors,
  LogFirstCellContent,
  LogsTableBodyFirstCell,
  StyledChevronButton,
} from 'sentry/views/explore/logs/styles';
import {OurLogKnownFieldKey} from 'sentry/views/explore/logs/types';
import {SeverityLevel} from 'sentry/views/explore/logs/utils';
import {useMetricSamplesTable} from 'sentry/views/explore/metrics/hooks/useMetricSamplesTable';
import {useTraceTelemetry} from 'sentry/views/explore/metrics/hooks/useTraceTelemetry';
import {TraceDetails} from 'sentry/views/explore/metrics/metricInfoTabs/samplesTab/traceDetails';
import {
  useQueryParamsSortBys,
  useSetQueryParamsSortBys,
} from 'sentry/views/explore/queryParams/context';
import {FieldRenderer} from 'sentry/views/explore/tables/fieldRenderer';
import {TraceViewSources} from 'sentry/views/performance/newTraceDetails/traceHeader/breadcrumbs';
import {getTraceDetailsUrl} from 'sentry/views/performance/traceDetails/utils';

const RESULT_LIMIT = 50;
const TWO_MINUTE_DELAY = 120;

const METRIC_SAMPLE_COLUMNS = ['timestamp', 'value', 'trace'];

interface SamplesTabProps {
  metricName: string;
}

export function SamplesTab({metricName}: SamplesTabProps) {
  const {result, eventView, fields} = useMetricSamplesTable({
    enabled: Boolean(metricName),
    limit: RESULT_LIMIT,
    metricName,
    fields: ['timestamp', 'trace', 'value', 'id', 'project.id'],
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
  const {initialTableStyles} = useTableStyles(METRIC_SAMPLE_COLUMNS, tableRef, {
    minimumColumnWidth: 50,
    prefixColumnWidth: 'min-content',
  });

  const meta = result.meta ?? {};

  const fieldLabels: Record<string, string> = {
    trace: t('Trace'),
    value: t('Value'),
    timestamp: t('Timestamp'),
  };

  return (
    <TableContainer>
      {(result.isPending || isTelemetryLoading) && <TransparentLoadingMask />}
      <StyledTable ref={tableRef} style={initialTableStyles}>
        <TableHead>
          <TableRow>
            <StyledFirstTableHeadCell isFirst align="left">
              <TableHeadCellContent isFrozen />
            </StyledFirstTableHeadCell>
            {METRIC_SAMPLE_COLUMNS.map((field, i) => {
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
                  <TableHeadCellContent onClick={updateSort}>
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
            result.data.map((row, i) => (
              <SampleTableRow
                key={i}
                row={row}
                telemetryData={telemetryData}
                fields={fields}
                columns={columns}
                meta={meta}
              />
            ))
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
      </StyledTable>
    </TableContainer>
  );
}

function SampleTableRow({
  row,
  telemetryData,
  fields,
  columns,
  meta,
}: {
  columns: any;
  fields: string[];
  meta: any;
  row: any;
  telemetryData: any;
}) {
  const organization = useOrganization();
  const {selection} = usePageFilters();
  const location = useLocation();
  const theme = useTheme();
  const measureRef = useRef<HTMLTableRowElement>(null);
  const [isExpanded, setIsExpanded] = useState(false);

  const traceId = row.trace as string;
  const telemetry = telemetryData.get(traceId);

  const renderTraceCell = () => {
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

  const renderTimestampCell = (field: string, originalFieldIndex: number) => {
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

  const renderDefaultCell = (field: string, originalFieldIndex: number) => {
    return (
      <FieldRenderer
        column={columns[originalFieldIndex]}
        data={row}
        unit={meta?.units?.[field]}
        meta={meta}
      />
    );
  };

  const renderFieldCell = (field: string) => {
    const originalFieldIndex = fields.indexOf(field);
    if (originalFieldIndex === -1) {
      return null;
    }

    switch (field) {
      case 'trace':
        return renderTraceCell();
      case 'timestamp':
        return renderTimestampCell(field, originalFieldIndex);
      default:
        return renderDefaultCell(field, originalFieldIndex);
    }
  };

  return (
    <Fragment>
      <TableRow>
        <LogsTableBodyFirstCell key="first">
          <LogFirstCellContent>
            <StyledChevronButton
              icon={<IconChevron size="xs" direction={isExpanded ? 'down' : 'right'} />}
              aria-label={t('Toggle trace details')}
              aria-expanded={isExpanded}
              size="zero"
              borderless
              onClick={() => setIsExpanded(!isExpanded)}
            />
          </LogFirstCellContent>
        </LogsTableBodyFirstCell>
        {METRIC_SAMPLE_COLUMNS.map((field, i) => (
          <StyledTableBodyCell key={i} isFirst={i === 0}>
            {renderFieldCell(field)}
          </StyledTableBodyCell>
        ))}
      </TableRow>
      {isExpanded && <TraceDetails dataRow={row} ref={measureRef} />}
    </Fragment>
  );
}

const StyledTable = styled(Table)`
  height: 100%;
  overflow: auto;
`;

const TableContainer = styled('div')`
  height: 100%;
  position: relative;
`;

const StyledTableBodyCell = styled(GridBodyCell)<{align?: Alignments; isFirst?: boolean}>`
  font-size: ${p => p.theme.fontSize.sm};
  min-height: 12px;
  ${p => p.align && `justify-content: ${p.align};`}
  ${p => p.isFirst && `padding-left: 0;`}
`;

const TableHeadCell = styled(GridHeadCell)<{align?: Alignments; isFirst?: boolean}>`
  ${p => p.align && `justify-content: ${p.align};`}
  font-size: ${p => p.theme.fontSize.sm};
  height: 33px;
  ${p => p.isFirst && `padding-left: 0;`}
`;

const TransparentLoadingMask = styled(LoadingMask)`
  opacity: 0.4;
  z-index: 1;
`;

const StyledFirstTableHeadCell = styled(FirstTableHeadCell)`
  height: 100%;
  border-right: none;
`;
