import {Fragment, useMemo, useRef, useState} from 'react';
import {useTheme} from '@emotion/react';

import {Flex} from '@sentry/scraps/layout';

import {Button} from 'sentry/components/core/button';
import {Link} from 'sentry/components/core/link';
import {Tooltip} from 'sentry/components/core/tooltip';
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
import {useQueryParamsSortBys} from 'sentry/views/explore/queryParams/context';
import {FieldRenderer} from 'sentry/views/explore/tables/fieldRenderer';
import {TraceViewSources} from 'sentry/views/performance/newTraceDetails/traceHeader/breadcrumbs';
import {getTraceDetailsUrl} from 'sentry/views/performance/traceDetails/utils';

const RESULT_LIMIT = 50;
const TWO_MINUTE_DELAY = 120;
const MAX_WIDTH = '40px';

const METRIC_SAMPLE_COLUMNS = ['timestamp', 'value', 'trace'];
const METRIC_SAMPLE_STAT_COLUMNS = ['logs', 'spans', 'errors'];

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

  const meta = result.meta ?? {};

  const fieldLabels: Record<string, string> = {
    trace: t('Trace'),
    value: metricName,
    timestamp: t('Timestamp'),
  };

  return (
    <StyledSimpleTable
      style={{
        gridTemplateColumns:
          'min-content min-content min-content min-content min-content min-content min-content minmax(15px, 1fr)',
      }}
    >
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
        {METRIC_SAMPLE_STAT_COLUMNS.map((_, i) => (
          <StyledSimpleTableHeaderCell
            key={`stat-${i}`}
            divider={false}
            style={{width: '5px'}}
          />
        ))}
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
    </StyledSimpleTable>
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
      <WrappingText style={{maxWidth: MAX_WIDTH}}>
        <Tooltip title={t('Logs')}>
          <Flex gap="xs" style={{color: theme.gray400, alignItems: 'center'}}>
            <IconTerminal color="gray400" />
            {telemetry?.logsCount ?? 0}
          </Flex>
        </Tooltip>
      </WrappingText>
    );
  };

  const renderSpansCell = () => {
    return (
      <WrappingText style={{maxWidth: MAX_WIDTH}}>
        <Tooltip title={t('Spans')}>
          <Flex gap="2xs" style={{color: theme.purple400, alignItems: 'center'}}>
            <IconSpan />
            {telemetry?.spansCount ?? 0}
          </Flex>
        </Tooltip>
      </WrappingText>
    );
  };

  const renderErrorsCell = () => {
    return (
      <WrappingText style={{maxWidth: MAX_WIDTH}}>
        <Tooltip title={t('Errors')}>
          <Flex gap="xs" style={{color: theme.red300, alignItems: 'center'}}>
            <IconFire />
            {telemetry?.errorsCount ?? 0}
          </Flex>
        </Tooltip>
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
          <StyledSimpleTableRowCell key={`stat-${i}`}>
            {renderFieldCell(field)}
          </StyledSimpleTableRowCell>
        ))}
      </StickyTableRow>
      {isExpanded && (
        <ExpandedRowContainer>
          <MetricDetails dataRow={row} ref={measureRef} />
        </ExpandedRowContainer>
      )}
    </Fragment>
  );
}
