import {Fragment, useMemo, useRef, useState, type ReactNode} from 'react';
import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';

import {Button} from 'sentry/components/core/button';
import {Link} from 'sentry/components/core/link';
import {Tooltip} from 'sentry/components/core/tooltip';
import Count from 'sentry/components/count';
import EmptyStateWarning from 'sentry/components/emptyStateWarning';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import {SimpleTable} from 'sentry/components/tables/simpleTable';
import {IconChevron, IconFire, IconSpan, IconTerminal} from 'sentry/icons';
import {IconWarning} from 'sentry/icons/iconWarning';
import {t} from 'sentry/locale';
import {getShortEventId} from 'sentry/utils/events';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';
import {TimestampRenderer} from 'sentry/views/explore/logs/fieldRenderers';
import {getLogColors} from 'sentry/views/explore/logs/styles';
import {SeverityLevel} from 'sentry/views/explore/logs/utils';
import {useMetricSamplesTable} from 'sentry/views/explore/metrics/hooks/useMetricSamplesTable';
import {useTraceTelemetry} from 'sentry/views/explore/metrics/hooks/useTraceTelemetry';
import {
  ExpandedRowContainer,
  NumericSimpleTableHeaderCell,
  NumericSimpleTableRowCell,
  StickyTableRow,
  StyledSimpleTable,
  StyledSimpleTableBody,
  StyledSimpleTableHeader,
  StyledSimpleTableHeaderCell,
  StyledSimpleTableRowCell,
  TransparentLoadingMask,
  WrappingText,
} from 'sentry/views/explore/metrics/metricInfoTabs/metricInfoTabStyles';
import {MetricDetails} from 'sentry/views/explore/metrics/metricInfoTabs/samplesTab/metricDetails';
import type {TraceMetric} from 'sentry/views/explore/metrics/metricQuery';
import {useQueryParamsSortBys} from 'sentry/views/explore/queryParams/context';
import {FieldRenderer} from 'sentry/views/explore/tables/fieldRenderer';
import {TraceViewSources} from 'sentry/views/performance/newTraceDetails/traceHeader/breadcrumbs';
import {getTraceDetailsUrl} from 'sentry/views/performance/traceDetails/utils';

const RESULT_LIMIT = 50;
const TWO_MINUTE_DELAY = 120;
const MAX_TELEMETRY_WIDTH = 40;
const VALUE_COLUMN_MIN_WIDTH = '50px';

// The width of all of the columns in the samples table, accounting for
// the expand button (36px), timestamp (121px), trace ID (66px), and value columns (72px)
export const SAMPLES_PANEL_MIN_WIDTH = 305;

const METRIC_SAMPLE_COLUMNS = ['timestamp', 'trace'];
const METRIC_SAMPLE_STAT_COLUMNS = ['logs', 'spans', 'errors'];
const ICON_HEADERS = {
  logs: <IconTerminal color="gray400" />,
  spans: <IconSpan color="purple400" />,
  errors: <IconFire color="red300" />,
};

interface SamplesTabProps {
  traceMetric: TraceMetric;
}

export function SamplesTab({traceMetric}: SamplesTabProps) {
  const {result, eventView, fields} = useMetricSamplesTable({
    enabled: Boolean(traceMetric.name),
    limit: RESULT_LIMIT,
    traceMetric,
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
    enabled: Boolean(traceMetric.name) && traceIds.length > 0,
    traceIds,
  });

  const columns = useMemo(() => eventView.getColumns(), [eventView]);
  const sorts = useQueryParamsSortBys();

  const meta = result.meta ?? {};

  const fieldLabels: Record<string, ReactNode> = {
    trace: t('Trace'),
    value: t('Value'),
    timestamp: t('Timestamp'),
    logs: t('Logs'),
    spans: t('Spans'),
    errors: t('Errors'),
  };

  return (
    <SimpleTableWithHiddenColumns numColumns={Object.keys(fieldLabels).length}>
      {(result.isPending || isTelemetryLoading) && <TransparentLoadingMask />}

      <StyledSimpleTableHeader>
        <StyledSimpleTableHeaderCell divider={false} style={{width: '5px'}} />
        {METRIC_SAMPLE_COLUMNS.map((field, i) => {
          const label = fieldLabels[field] ?? field;
          const direction = sorts.find(s => s.field === field)?.kind;

          return (
            <StyledSimpleTableHeaderCell key={i} sort={direction}>
              <Tooltip showOnlyOnOverflow title={label}>
                {label}
              </Tooltip>
            </StyledSimpleTableHeaderCell>
          );
        })}
        {METRIC_SAMPLE_STAT_COLUMNS.map((field, i) => (
          <NumericSimpleTableHeaderCell
            key={`stat-${i}`}
            divider={false}
            style={{width: '32px', padding: '0px'}}
            data-column-name={field}
          >
            <Tooltip title={fieldLabels[field]} skipWrapper>
              {ICON_HEADERS[field as keyof typeof ICON_HEADERS]}
            </Tooltip>
          </NumericSimpleTableHeaderCell>
        ))}

        <NumericSimpleTableHeaderCell sort={sorts.find(s => s.field === 'value')?.kind}>
          <Tooltip showOnlyOnOverflow title={fieldLabels.value ?? 'value'}>
            {fieldLabels.value ?? 'value'}
          </Tooltip>
        </NumericSimpleTableHeaderCell>
      </StyledSimpleTableHeader>

      <StyledSimpleTableBody>
        {result.isError ? (
          <SimpleTable.Empty>
            <IconWarning data-test-id="error-indicator" color="gray300" size="lg" />
          </SimpleTable.Empty>
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
          <SimpleTable.Empty>
            <LoadingIndicator />
          </SimpleTable.Empty>
        ) : (
          <SimpleTable.Empty>
            <EmptyStateWarning>
              <p>{t('No samples found')}</p>
            </EmptyStateWarning>
          </SimpleTable.Empty>
        )}
      </StyledSimpleTableBody>
    </SimpleTableWithHiddenColumns>
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
  const [isExpanded, setIsExpanded] = useState(false);
  const measureRef = useRef<HTMLTableRowElement>(null);

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
      <WrappingText>
        <Link to={target} style={{minWidth: '66px'}}>
          {getShortEventId(traceId)}
        </Link>
      </WrappingText>
    );
  };

  const renderLogsCell = () => {
    return (
      <WrappingText
        style={{
          maxWidth: MAX_TELEMETRY_WIDTH,
          color: theme.gray400,
          alignItems: 'center',
          justifyContent: 'flex-end',
        }}
      >
        <Count value={telemetry?.logsCount ?? 0} />
      </WrappingText>
    );
  };

  const renderSpansCell = () => {
    return (
      <WrappingText
        style={{
          maxWidth: MAX_TELEMETRY_WIDTH,
          color: theme.purple400,
          alignItems: 'center',
          justifyContent: 'flex-end',
        }}
      >
        <Count value={telemetry?.spansCount ?? 0} />
      </WrappingText>
    );
  };

  const renderErrorsCell = () => {
    return (
      <WrappingText
        style={{
          maxWidth: MAX_TELEMETRY_WIDTH,
          color: theme.red300,
          alignItems: 'center',
        }}
      >
        <Count value={telemetry?.errorsCount ?? 0} />
      </WrappingText>
    );
  };

  const renderTimestampCell = (field: string) => {
    return (
      <div style={{whiteSpace: 'nowrap'}}>
        {TimestampRenderer({
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
        })}
      </div>
    );
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
    if (originalFieldIndex === -1 && !METRIC_SAMPLE_STAT_COLUMNS.includes(field)) {
      return null;
    }

    switch (field) {
      case 'trace':
        return renderTraceCell();
      case 'timestamp':
        return renderTimestampCell(field);
      case 'logs':
        return renderLogsCell();
      case 'spans':
        return renderSpansCell();
      case 'errors':
        return renderErrorsCell();
      default:
        return renderDefaultCell(field, originalFieldIndex);
    }
  };

  return (
    <Fragment>
      <StickyTableRow isSticky={isExpanded}>
        <StyledSimpleTableRowCell>
          <Button
            icon={<IconChevron size="xs" direction={isExpanded ? 'down' : 'right'} />}
            aria-label={t('Toggle trace details')}
            aria-expanded={isExpanded}
            size="sm"
            borderless
            onClick={() => setIsExpanded(!isExpanded)}
          />
        </StyledSimpleTableRowCell>
        {METRIC_SAMPLE_COLUMNS.map((field, i) => (
          <StyledSimpleTableRowCell key={i} hasPadding>
            {renderFieldCell(field)}
          </StyledSimpleTableRowCell>
        ))}
        {METRIC_SAMPLE_STAT_COLUMNS.map((field, i) => (
          <NumericSimpleTableRowCell
            key={`stat-${i}`}
            data-column-name={field}
            hasPadding
            style={{justifyContent: 'flex-end'}}
          >
            {renderFieldCell(field)}
          </NumericSimpleTableRowCell>
        ))}
        <NumericSimpleTableRowCell hasPadding style={{minWidth: VALUE_COLUMN_MIN_WIDTH}}>
          <Tooltip showOnlyOnOverflow title={row.value}>
            {renderFieldCell('value')}
          </Tooltip>
        </NumericSimpleTableRowCell>
      </StickyTableRow>
      {isExpanded && (
        <ExpandedRowContainer>
          <MetricDetails dataRow={row} ref={measureRef} />
        </ExpandedRowContainer>
      )}
    </Fragment>
  );
}

const SimpleTableWithHiddenColumns = styled(StyledSimpleTable)<{numColumns: number}>`
  grid-template-columns: repeat(${p => p.numColumns}, min-content) 1fr;

  @container (max-width: ${SAMPLES_PANEL_MIN_WIDTH + MAX_TELEMETRY_WIDTH * 3}px) {
    grid-template-columns: repeat(${p => p.numColumns - 1}, min-content) 1fr;

    [data-column-name='errors'] {
      display: none;
    }
  }

  @container (max-width: ${SAMPLES_PANEL_MIN_WIDTH + MAX_TELEMETRY_WIDTH * 2}px) {
    grid-template-columns: repeat(${p => p.numColumns - 2}, min-content) 1fr;

    [data-column-name='spans'] {
      display: none;
    }
  }

  @container (max-width: ${SAMPLES_PANEL_MIN_WIDTH + MAX_TELEMETRY_WIDTH * 1}px) {
    grid-template-columns: repeat(${p => p.numColumns - 3}, min-content) 1fr;

    [data-column-name='logs'] {
      display: none;
    }
  }
`;
