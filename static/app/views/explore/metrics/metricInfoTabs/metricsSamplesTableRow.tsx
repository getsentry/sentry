import {useRef, useState, type ReactNode} from 'react';
import {useTheme} from '@emotion/react';

import {Flex} from '@sentry/scraps/layout/flex';

import {Button} from 'sentry/components/core/button';
import {Link} from 'sentry/components/core/link';
import {Tooltip} from 'sentry/components/core/tooltip';
import Count from 'sentry/components/count';
import ProjectBadge from 'sentry/components/idBadge/projectBadge';
import {IconChevron} from 'sentry/icons';
import {t} from 'sentry/locale';
import type {TableDataRow} from 'sentry/utils/discover/discoverQuery';
import type {EventsMetaType} from 'sentry/utils/discover/eventView';
import type {ColumnValueType} from 'sentry/utils/discover/fields';
import {getShortEventId} from 'sentry/utils/events';
import {FieldValueType} from 'sentry/utils/fields';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';
import useProjects from 'sentry/utils/useProjects';
import type {TableColumn} from 'sentry/views/discover/table/types';
import {TimestampRenderer} from 'sentry/views/explore/logs/fieldRenderers';
import {getLogColors} from 'sentry/views/explore/logs/styles';
import {SeverityLevel} from 'sentry/views/explore/logs/utils';
import {
  NoPaddingColumns,
  type AlwaysPresentTraceMetricFields,
} from 'sentry/views/explore/metrics/constants';
import {useTraceTelemetry} from 'sentry/views/explore/metrics/hooks/useTraceTelemetry';
import {MetricDetails} from 'sentry/views/explore/metrics/metricInfoTabs/metricDetails';
import {
  ExpandedRowContainer,
  NumericSimpleTableRowCell,
  StickyTableRow,
  StyledSimpleTableRowCell,
  TableRowContainer,
  WrappingText,
} from 'sentry/views/explore/metrics/metricInfoTabs/metricInfoTabStyles';
import {stripMetricParamsFromLocation} from 'sentry/views/explore/metrics/metricQuery';
import {MetricTypeBadge} from 'sentry/views/explore/metrics/metricToolbar/metricSelector';
import {
  TraceMetricKnownFieldKey,
  VirtualTableSampleColumnKey,
  type SampleTableColumnKey,
  type TraceMetricEventsResponseItem,
  type TraceMetricTypeValue,
} from 'sentry/views/explore/metrics/types';
import {getMetricTableColumnType} from 'sentry/views/explore/metrics/utils';
import {FieldRenderer} from 'sentry/views/explore/tables/fieldRenderer';
import {TraceViewSources} from 'sentry/views/performance/newTraceDetails/traceHeader/breadcrumbs';
import {TraceLayoutTabKeys} from 'sentry/views/performance/newTraceDetails/useTraceLayoutTabs';
import {getTraceDetailsUrl} from 'sentry/views/performance/traceDetails/utils';

const MAX_TELEMETRY_WIDTH = 40;
const VALUE_COLUMN_MIN_WIDTH = '50px';
interface SampleTableRowProps {
  columns: SampleTableColumnKey[];
  meta: EventsMetaType;
  row: TraceMetricEventsResponseItem;
  telemetryData: ReturnType<typeof useTraceTelemetry>['data'];
  embedded?: boolean;
  ref?: (element: HTMLElement | null) => void;
}

function FieldCellWrapper({
  field,
  row,
  children,
  index,
  embedded = false,
}: {
  children: ReactNode;
  field: SampleTableColumnKey;
  index: number;
  row: TraceMetricEventsResponseItem;
  embedded?: boolean;
}) {
  const columnType = getMetricTableColumnType(field);
  const hasPadding = !NoPaddingColumns.includes(field as VirtualTableSampleColumnKey);
  if (columnType === 'stat') {
    return (
      <NumericSimpleTableRowCell
        key={`stat-${index}`}
        data-column-name={field}
        embedded={embedded}
      >
        {children}
      </NumericSimpleTableRowCell>
    );
  }
  if (columnType === 'metric_value') {
    return (
      <NumericSimpleTableRowCell
        key={index}
        style={{minWidth: VALUE_COLUMN_MIN_WIDTH}}
        embedded={embedded}
      >
        <Tooltip showOnlyOnOverflow title={row[TraceMetricKnownFieldKey.METRIC_VALUE]}>
          {children}
        </Tooltip>
      </NumericSimpleTableRowCell>
    );
  }
  return (
    <StyledSimpleTableRowCell key={index} embedded={embedded} noPadding={!hasPadding}>
      {children}
    </StyledSimpleTableRowCell>
  );
}

export function SampleTableRow({
  row,
  telemetryData,
  columns,
  meta,
  embedded = false,
  ref,
}: SampleTableRowProps) {
  const organization = useOrganization();
  const {selection} = usePageFilters();
  const location = useLocation();
  const theme = useTheme();
  const [isExpanded, setIsExpanded] = useState(false);
  const measureRef = useRef<HTMLTableRowElement>(null);
  const projects = useProjects();
  const projectId: (typeof AlwaysPresentTraceMetricFields)[1] =
    row[TraceMetricKnownFieldKey.PROJECT_ID];
  const project = projects.projects.find(p => p.id === '' + projectId);
  const projectSlug = project?.slug ?? '';

  const traceId = row[TraceMetricKnownFieldKey.TRACE];
  const telemetry = telemetryData?.get?.(traceId);

  const renderExpandRowCell = () => {
    return (
      <Button
        icon={<IconChevron size="xs" direction={isExpanded ? 'down' : 'right'} />}
        aria-label={t('Toggle trace details')}
        aria-expanded={isExpanded}
        size={embedded ? 'zero' : 'sm'}
        borderless
        onClick={() => setIsExpanded(!isExpanded)}
      />
    );
  };

  const renderTraceCell = () => {
    const timestamp = row[TraceMetricKnownFieldKey.TIMESTAMP];
    const spanId = row[TraceMetricKnownFieldKey.SPAN_ID];
    const oldSpanId = row[TraceMetricKnownFieldKey.OLD_SPAN_ID] as string;
    const spanIdToUse = oldSpanId || spanId;
    const strippedLocation = stripMetricParamsFromLocation(location);

    const hasSpans = (telemetry?.spansCount ?? 0) > 0;
    const shouldGoToSpans = spanIdToUse && hasSpans;

    const target = getTraceDetailsUrl({
      organization,
      traceSlug: traceId,
      dateSelection: {
        start: selection.datetime.start,
        end: selection.datetime.end,
        statsPeriod: selection.datetime.period,
      },
      timestamp,
      location: strippedLocation,
      source: TraceViewSources.TRACE_METRICS,
      spanId: shouldGoToSpans ? spanIdToUse : undefined,
      // tab: shouldGoToSpans ? TraceLayoutTabKeys.WATERFALL : TraceLayoutTabKeys.METRICS, // TODO: Can use this if want to go to the waterfall view if we add metrics to span details.
      tab: TraceLayoutTabKeys.METRICS,
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
          color: theme.colors.gray500,
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
          color: theme.tokens.content.accent,
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
          color: theme.colors.red400,
          alignItems: 'center',
          justifyContent: 'flex-end',
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
            value: row[field] ?? null,
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

  const renderDefaultCell = (field: string) => {
    const discoverColumn: TableColumn<keyof TableDataRow> = {
      column: {
        field,
        kind: 'field',
      },
      name: field,
      key: field,
      isSortable: true,
      type: (meta?.fields?.[field] as ColumnValueType) ?? FieldValueType.STRING,
    };
    return (
      <FieldRenderer
        column={discoverColumn}
        data={row}
        unit={meta?.units?.[field]}
        meta={meta}
      />
    );
  };

  const renderMetricTypeCell = () => {
    return (
      <MetricTypeBadge
        metricType={row[TraceMetricKnownFieldKey.METRIC_TYPE] as TraceMetricTypeValue}
      />
    );
  };

  const renderProjectCell = () => {
    return (
      <Flex align="center" justify="center" minWidth="18px">
        <ProjectBadge avatarSize={14} project={project ?? {slug: projectSlug}} hideName />
      </Flex>
    );
  };

  const renderMap: Record<SampleTableColumnKey, () => ReactNode> = {
    [VirtualTableSampleColumnKey.EXPAND_ROW]: renderExpandRowCell,
    [TraceMetricKnownFieldKey.TRACE]: renderTraceCell,
    [TraceMetricKnownFieldKey.TIMESTAMP]: () =>
      renderTimestampCell(TraceMetricKnownFieldKey.TIMESTAMP),
    [VirtualTableSampleColumnKey.LOGS]: renderLogsCell,
    [VirtualTableSampleColumnKey.SPANS]: renderSpansCell,
    [VirtualTableSampleColumnKey.ERRORS]: renderErrorsCell,
    [VirtualTableSampleColumnKey.PROJECT_BADGE]: renderProjectCell,
    [TraceMetricKnownFieldKey.METRIC_TYPE]: renderMetricTypeCell,
  };

  const renderFieldCell = (field: SampleTableColumnKey) => {
    return renderMap[field]?.() ?? renderDefaultCell(field);
  };

  return (
    <TableRowContainer ref={ref}>
      <StickyTableRow sticky={isExpanded ? true : undefined}>
        {columns.map((field, i) => {
          const isValueColumn = field === TraceMetricKnownFieldKey.METRIC_VALUE;
          const cellContent = renderFieldCell(field);

          return (
            <FieldCellWrapper
              key={i}
              field={field}
              index={i}
              row={row}
              embedded={embedded}
            >
              {isValueColumn ? (
                <Tooltip
                  showOnlyOnOverflow
                  title={row[TraceMetricKnownFieldKey.METRIC_VALUE]}
                >
                  {cellContent}
                </Tooltip>
              ) : (
                cellContent
              )}
            </FieldCellWrapper>
          );
        })}
      </StickyTableRow>
      {isExpanded && (
        <ExpandedRowContainer>
          <MetricDetails dataRow={row} ref={measureRef} />
        </ExpandedRowContainer>
      )}
    </TableRowContainer>
  );
}
