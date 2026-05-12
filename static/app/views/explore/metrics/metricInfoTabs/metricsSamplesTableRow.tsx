import {useRef, useState, type ReactNode} from 'react';

import {Button} from '@sentry/scraps/button';
import {Flex} from '@sentry/scraps/layout';
import {Link} from '@sentry/scraps/link';
import {Tooltip} from '@sentry/scraps/tooltip';

import type {MenuItemProps} from 'sentry/components/dropdownMenu';
import ProjectBadge from 'sentry/components/idBadge/projectBadge';
import {usePageFilters} from 'sentry/components/pageFilters/usePageFilters';
import {TimeSince} from 'sentry/components/timeSince';
import {IconChevron} from 'sentry/icons';
import {t} from 'sentry/locale';
import type {PageFilters} from 'sentry/types/core';
import type {Organization} from 'sentry/types/organization';
import type {TableDataRow} from 'sentry/utils/discover/discoverQuery';
import type {EventsMetaType} from 'sentry/utils/discover/eventView';
import type {ColumnValueType} from 'sentry/utils/discover/fields';
import {getShortEventId} from 'sentry/utils/events';
import {FieldValueType} from 'sentry/utils/fields';
import {useLocation} from 'sentry/utils/useLocation';
import {useOrganization} from 'sentry/utils/useOrganization';
import {useProjects} from 'sentry/utils/useProjects';
import type {TableColumn} from 'sentry/views/discover/table/types';
import {Mode} from 'sentry/views/explore/contexts/pageParamsContext/mode';
import {MetricDetails} from 'sentry/views/explore/metrics/metricInfoTabs/metricDetails';
import {
  ExpandedRowContainer,
  NumericSimpleTableRowCell,
  StickyTableRow,
  StyledSimpleTableRowCell,
  TableRowContainer,
  WrappingText,
} from 'sentry/views/explore/metrics/metricInfoTabs/metricInfoTabStyles';
import {StyledTimestampWrapper} from 'sentry/views/explore/metrics/metricInfoTabs/styles';
import {stripMetricParamsFromLocation} from 'sentry/views/explore/metrics/metricQuery';
import {MetricTypeBadge} from 'sentry/views/explore/metrics/metricToolbar/metricOptionLabel';
import {
  TraceMetricKnownFieldKey,
  VirtualTableSampleColumnKey,
  type SampleTableColumnKey,
  type TraceMetricEventsResponseItem,
} from 'sentry/views/explore/metrics/types';
import {getMetricTableColumnType} from 'sentry/views/explore/metrics/utils';
import {FieldRenderer} from 'sentry/views/explore/tables/fieldRenderer';
import {getExploreUrl} from 'sentry/views/explore/utils';
import {TraceViewSources} from 'sentry/views/performance/newTraceDetails/traceHeader/breadcrumbs';
import {TraceLayoutTabKeys} from 'sentry/views/performance/newTraceDetails/useTraceLayoutTabs';
import {getTraceDetailsUrl} from 'sentry/views/performance/traceDetails/utils';

const VALUE_COLUMN_MIN_WIDTH = '50px';
const EXPLORE_SIMILAR_SPANS_REFERRER = 'trace-metrics-samples-table-similar-spans';

const getExtraMenuItems = ({
  embedded,
  field,
  organization,
  row,
  selection,
}: {
  embedded: boolean;
  field: SampleTableColumnKey;
  organization: Organization;
  row: TraceMetricEventsResponseItem;
  selection: PageFilters;
}): MenuItemProps[] | undefined => {
  if (!embedded || field !== TraceMetricKnownFieldKey.METRIC_NAME) {
    return undefined;
  }

  const metricName = row[TraceMetricKnownFieldKey.METRIC_NAME];
  const metricType = row[TraceMetricKnownFieldKey.METRIC_TYPE];
  if (metricName.length === 0 || metricType.length === 0) {
    return undefined;
  }

  const metricUnit = row[TraceMetricKnownFieldKey.METRIC_UNIT];
  const metric = {
    name: metricName,
    type: metricType,
    unit: metricUnit?.length > 0 ? metricUnit : undefined,
  };

  return [
    {
      key: 'explore-similar-spans',
      label: t('Explore similar spans'),
      to: getExploreUrl({
        organization,
        mode: Mode.SAMPLES,
        referrer: EXPLORE_SIMILAR_SPANS_REFERRER,
        selection: {
          ...selection,
          datetime: {
            period: '24h',
            start: null,
            end: null,
            utc: selection.datetime.utc,
          },
        },
        crossEvents: [
          {
            type: 'metrics',
            query: '',
            metric,
          },
        ],
      }),
    },
  ];
};

interface SampleTableRowProps {
  columns: SampleTableColumnKey[];
  meta: EventsMetaType;
  row: TraceMetricEventsResponseItem;
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
  const hasPadding = field !== VirtualTableSampleColumnKey.EXPAND_ROW;
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
  columns,
  meta,
  embedded = false,
  ref,
}: SampleTableRowProps) {
  const organization = useOrganization();
  const {selection} = usePageFilters();
  const location = useLocation();
  const [isExpanded, setIsExpanded] = useState(false);
  const measureRef = useRef<HTMLTableRowElement>(null);
  const projects = useProjects();
  const projectId = row[TraceMetricKnownFieldKey.PROJECT_ID];
  const project = projects.projects.find(p => p.id === '' + projectId);
  const projectSlug = project?.slug ?? '';

  const traceId = row[TraceMetricKnownFieldKey.TRACE];

  const renderExpandRowCell = () => {
    return (
      <Button
        icon={<IconChevron size="xs" direction={isExpanded ? 'down' : 'right'} />}
        aria-label={t('Toggle trace details')}
        aria-expanded={isExpanded}
        size={embedded ? 'zero' : 'sm'}
        variant="transparent"
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
      spanId: spanIdToUse || undefined,
      // tab: spanIdToUse ? TraceLayoutTabKeys.WATERFALL : TraceLayoutTabKeys.METRICS, // TODO: Can use this if want to go to the waterfall view if we add metrics to span details.
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

  const renderTimestampCell = (field: string) => {
    const timestamp = row[field];
    if (timestamp === undefined) {
      return null;
    }

    return (
      <StyledTimestampWrapper>
        <TimeSince date={timestamp} unitStyle="short" tooltipShowSeconds />
      </StyledTimestampWrapper>
    );
  };

  const renderDefaultCell = (field: string) => {
    // For the metric value column, keep column.type as 'number' so that
    // CellAction/updateQuery adds the raw numeric value to the filter
    // instead of converting it with a duration assumption. The renderer
    // still picks up the correct formatter via meta.fields/meta.units.
    const isMetricValue = field === TraceMetricKnownFieldKey.METRIC_VALUE;
    const discoverColumn: TableColumn<keyof TableDataRow> = {
      column: {
        field,
        kind: 'field',
      },
      name: field,
      key: field,
      isSortable: true,
      type: isMetricValue
        ? 'number'
        : ((meta?.fields?.[field] as ColumnValueType) ?? FieldValueType.STRING),
    };
    return (
      <FieldRenderer
        column={discoverColumn}
        data={row}
        unit={meta?.units?.[field]}
        meta={meta}
        extraMenuItems={getExtraMenuItems({
          embedded,
          field,
          organization,
          row,
          selection,
        })}
      />
    );
  };

  const renderMetricTypeCell = () => {
    return <MetricTypeBadge metricType={row[TraceMetricKnownFieldKey.METRIC_TYPE]} />;
  };

  const renderProjectCell = () => {
    return (
      <Flex align="center" minWidth="0" width="100%">
        <ProjectBadge
          avatarSize={14}
          project={project ?? {slug: projectSlug}}
          disableLink
        />
      </Flex>
    );
  };

  const renderMap: Record<SampleTableColumnKey, () => ReactNode> = {
    [VirtualTableSampleColumnKey.EXPAND_ROW]: renderExpandRowCell,
    [TraceMetricKnownFieldKey.TRACE]: renderTraceCell,
    [TraceMetricKnownFieldKey.TIMESTAMP]: () =>
      renderTimestampCell(TraceMetricKnownFieldKey.TIMESTAMP),
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
