import {Fragment} from 'react';
import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';
import type {Location} from 'history';

import {LinkButton} from '@sentry/scraps/button';
import {Container} from '@sentry/scraps/layout';
import {Link} from '@sentry/scraps/link';
import {Tooltip} from '@sentry/scraps/tooltip';

import {Duration} from 'sentry/components/duration';
import {normalizeDateTimeParams} from 'sentry/components/pageFilters/parse';
import {usePageFilters} from 'sentry/components/pageFilters/usePageFilters';
import {Pagination, type CursorHandler} from 'sentry/components/pagination';
import {RowRectangle} from 'sentry/components/performance/waterfall/rowBar';
import {pickBarColor} from 'sentry/components/performance/waterfall/utils';
import {QuestionTooltip} from 'sentry/components/questionTooltip';
import {
  COL_WIDTH_UNDEFINED,
  GridEditable,
  type GridColumnHeader,
} from 'sentry/components/tables/gridEditable';
import {IconPlay, IconProfiling} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import type {Organization} from 'sentry/types/organization';
import type {EventsMetaType, EventView} from 'sentry/utils/discover/eventView';
import {getFieldRenderer} from 'sentry/utils/discover/fieldRenderers';
import {
  getSpanOperationName,
  SPAN_OP_BREAKDOWN_FIELDS,
} from 'sentry/utils/discover/fields';
import {toPercent} from 'sentry/utils/number/toPercent';
import {decodeScalar, decodeSorts} from 'sentry/utils/queryString';
import {projectSupportsReplay} from 'sentry/utils/replays/projectSupportsReplay';
import type {Theme} from 'sentry/utils/theme';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import {normalizeUrl} from 'sentry/utils/url/normalizeUrl';
import {useLocation} from 'sentry/utils/useLocation';
import {useOrganization} from 'sentry/utils/useOrganization';
import {useProjects} from 'sentry/utils/useProjects';
import {renderHeadCell} from 'sentry/views/insights/common/components/tableCells/renderHeadCell';
import {SpanIdCell} from 'sentry/views/insights/common/components/tableCells/spanIdCell';
import {useSpans} from 'sentry/views/insights/common/queries/useDiscover';
import {QueryParameterNames} from 'sentry/views/insights/common/views/queryParameters';
import {ModuleName, type SpanProperty} from 'sentry/views/insights/types';
import {TraceViewSources} from 'sentry/views/performance/newTraceDetails/traceHeader/breadcrumbs';
import {getTraceDetailsUrl} from 'sentry/views/performance/traceDetails/utils';
import {
  platformToPerformanceType,
  ProjectPerformanceType,
} from 'sentry/views/performance/utils';

const LIMIT = 50;

const SPAN_OPS_BREAKDOWN_COLUMN_KEY = 'span_ops_breakdown.relative';

const BASE_FIELDS = [
  'span_id',
  'user.id',
  'user.email',
  'user.username',
  'user.ip',
  'span.duration',
  'trace',
  'timestamp',
  'profile.id',
  'profiler.id',
  'thread.id',
  'precise.start_ts',
  'precise.finish_ts',
  'spans.browser',
  'spans.db',
  'spans.http',
  'spans.resource',
  'spans.ui',
];

type SampledEventsColumn = GridColumnHeader<
  | 'span_id'
  | 'user.display'
  | 'request.method'
  | 'span.duration'
  | 'trace'
  | 'timestamp'
  | 'replayId'
  | 'profile.id'
  | typeof SPAN_OPS_BREAKDOWN_COLUMN_KEY
>;

const COLUMN_ORDER: SampledEventsColumn[] = [
  {key: 'span_id', name: t('Span ID'), width: COL_WIDTH_UNDEFINED},
  {key: 'user.display', name: t('User'), width: COL_WIDTH_UNDEFINED},
  {key: 'request.method', name: t('HTTP Method'), width: COL_WIDTH_UNDEFINED},
  {
    key: SPAN_OPS_BREAKDOWN_COLUMN_KEY,
    name: t('Operation Duration'),
    width: COL_WIDTH_UNDEFINED,
  },
  {key: 'span.duration', name: t('Total Duration'), width: COL_WIDTH_UNDEFINED},
  {key: 'trace', name: t('Trace ID'), width: COL_WIDTH_UNDEFINED},
  {key: 'timestamp', name: t('Timestamp'), width: COL_WIDTH_UNDEFINED},
  {key: 'replayId', name: t('Replay'), width: COL_WIDTH_UNDEFINED},
  {key: 'profile.id', name: t('Profile'), width: COL_WIDTH_UNDEFINED},
];

type Props = {
  eventView: EventView;
  isMaxDurationLoading: boolean;
  onCursor: CursorHandler;
  transactionName: string;
  cursor?: string;
  maxDuration?: number;
};

export function SampledEventsTable({
  eventView,
  transactionName,
  maxDuration,
  isMaxDurationLoading,
  cursor,
  onCursor,
}: Props) {
  const {selection} = usePageFilters();
  const location = useLocation();
  const {projects} = useProjects();
  const theme = useTheme();
  const organization = useOrganization();

  const project = projects.find(p => p.id === String(eventView.project[0]));
  const projectSlug = project?.slug;

  const isBackend =
    platformToPerformanceType(projects, eventView.project) ===
    ProjectPerformanceType.BACKEND;
  const showReplayColumn =
    organization.features.includes('session-replay') &&
    project !== undefined &&
    projectSupportsReplay(project);
  const hiddenColumns = new Set<string>();
  if (!isBackend) {
    hiddenColumns.add('request.method');
  }
  if (!showReplayColumn) {
    hiddenColumns.add('replayId');
  }
  const fields = [
    ...BASE_FIELDS,
    ...(isBackend ? ['request.method'] : []),
    ...(showReplayColumn ? ['replayId'] : []),
  ] as SpanProperty[];

  const columnOrder = COLUMN_ORDER.filter(col => !hiddenColumns.has(col.key));

  const searchQuery = decodeScalar(location.query.query, '');
  const sort = decodeSorts(location.query?.[QueryParameterNames.SPANS_SORT])[0] ?? {
    field: 'timestamp',
    kind: 'desc' as const,
  };

  const search = new MutableSearch(searchQuery);
  search.setFilterValues('is_transaction', ['true']);
  search.setFilterValues('transaction', [transactionName]);
  if (maxDuration !== undefined && maxDuration > 0) {
    search.setFilterValues('span.duration', [`<=${maxDuration.toFixed(0)}`]);
  }

  const {data: numEvents, error: numEventsError} = useSpans(
    {
      search,
      fields: ['count()'],
      pageFilters: selection,
      enabled: !isMaxDurationLoading,
    },
    'api.insights.segment-spans-table-count'
  );

  const pageEventsCount = Math.min(numEvents[0]?.['count()'] ?? 0, LIMIT);

  const paginationCaption = tct(
    'Showing [pageEventsCount] of [totalEventsCount] events',
    {
      pageEventsCount: pageEventsCount.toLocaleString(),
      totalEventsCount: numEvents[0]?.['count()']?.toLocaleString() ?? '...',
    }
  );

  const {
    data: tableData,
    isLoading,
    pageLinks,
    meta,
    error,
  } = useSpans(
    {
      search,
      fields,
      sorts: [sort],
      limit: LIMIT,
      cursor,
      pageFilters: selection,
      enabled: !isMaxDurationLoading,
    },
    'api.insights.segment-spans-table'
  );

  const consolidatedData = tableData?.map(row => {
    const user =
      row['user.username'] || row['user.email'] || row['user.ip'] || row['user.id'];
    return {
      ...row,
      'user.display': user,
    };
  });

  return (
    <Fragment>
      <GridEditable
        isLoading={isLoading || isMaxDurationLoading}
        error={error}
        data={consolidatedData}
        columnOrder={columnOrder}
        columnSortBy={[{key: sort.field, order: sort.kind}]}
        grid={{
          renderHeadCell: column => {
            if (column.key === SPAN_OPS_BREAKDOWN_COLUMN_KEY) {
              return (
                <Fragment>
                  <span>{column.name}</span>
                  <StyledQuestionTooltip
                    size="xs"
                    position="top"
                    title={t(
                      'Span durations are summed over the course of an entire transaction. Any overlapping spans are only counted once.'
                    )}
                  />
                </Fragment>
              );
            }
            return renderHeadCell({
              column,
              sort,
              location,
              sortParameterName: QueryParameterNames.SPANS_SORT,
            });
          },
          renderBodyCell: (column, row) =>
            renderBodyCell(column, row, meta, projectSlug, location, organization, theme),
        }}
      />
      <Pagination
        pageLinks={pageLinks}
        onCursor={onCursor}
        size="md"
        caption={numEventsError ? undefined : paginationCaption}
      />
    </Fragment>
  );
}

function renderBodyCell(
  column: SampledEventsColumn,
  row: Record<string, any>,
  meta: EventsMetaType | undefined,
  projectSlug: string | undefined,
  location: Location,
  organization: Organization,
  theme: Theme
) {
  if (column.key === 'span_id') {
    return (
      <SpanIdCell
        moduleName={ModuleName.OTHER}
        traceId={row.trace}
        timestamp={row.timestamp}
        transactionId={row.span_id}
        spanId={row.span_id}
        source={TraceViewSources.PERFORMANCE_TRANSACTION_SUMMARY}
        location={location}
      />
    );
  }

  if (column.key === 'trace') {
    const traceId = row.trace?.toString() ?? '';
    if (traceId) {
      const target = getTraceDetailsUrl({
        organization,
        traceSlug: traceId,
        dateSelection: normalizeDateTimeParams(location.query),
        timestamp: row.timestamp,
        location,
        source: TraceViewSources.PERFORMANCE_TRANSACTION_SUMMARY,
      });

      if (!meta?.fields) {
        return <Link to={target}>{traceId}</Link>;
      }

      const renderer = getFieldRenderer('trace', meta.fields, false);
      const rendered = renderer(row, {
        location,
        organization,
        theme,
        unit: meta.units?.trace,
      });

      return <Link to={target}>{rendered}</Link>;
    }
  }

  if (column.key === 'profile.id') {
    return (
      <div>
        <LinkButton
          size="xs"
          icon={<IconProfiling size="xs" />}
          to={{
            pathname: normalizeUrl(
              `/organizations/${organization.slug}/profiling/profile/${projectSlug}/${row['profile.id']}/flamegraph/`
            ),
            query: {
              referrer: 'performance',
            },
          }}
          aria-label={t('View Profile')}
          disabled={!row['profile.id']}
        />
      </div>
    );
  }

  if (column.key === 'replayId') {
    return (
      <div>
        <LinkButton
          size="xs"
          icon={<IconPlay size="xs" />}
          to={{
            pathname: normalizeUrl(
              `/organizations/${organization.slug}/replays/${row.replayId}/`
            ),
            query: {
              referrer: 'performance',
            },
          }}
          disabled={!row.replayId}
          aria-label={t('View Replay')}
        />
      </div>
    );
  }

  if (column.key === SPAN_OPS_BREAKDOWN_COLUMN_KEY) {
    return renderOperationDurationCell(row, theme);
  }

  if (!meta?.fields) {
    return row[column.key];
  }

  const renderer = getFieldRenderer(column.key, meta.fields, false);

  const rendered = renderer(row, {
    location,
    organization,
    theme,
    unit: meta.units?.[column.key],
  });

  return rendered;
}

function renderOperationDurationCell(row: Record<string, any>, theme: Theme) {
  const sumOfSpanTime = SPAN_OP_BREAKDOWN_FIELDS.reduce(
    (prev, curr) =>
      curr in row && typeof row[curr] === 'number' ? prev + row[curr] : prev,
    0
  );
  const cumulativeSpanOpBreakdown = Math.max(sumOfSpanTime, row['span.duration'] ?? 0);

  if (
    SPAN_OP_BREAKDOWN_FIELDS.every(
      field => !(field in row) || typeof row[field] !== 'number'
    ) ||
    cumulativeSpanOpBreakdown === 0
  ) {
    return (
      <Container width="100%">
        <Tooltip title={t('Other')} containerDisplayMode="block">
          <OtherRelativeOpsBreakdown />
        </Tooltip>
      </Container>
    );
  }

  let otherPercentage = 1;

  return (
    <RelativeOpsBreakdown data-test-id="relative-ops-breakdown">
      {SPAN_OP_BREAKDOWN_FIELDS.map(field => {
        if (!(field in row) || typeof row[field] !== 'number') {
          return null;
        }

        const operationName = getSpanOperationName(field) ?? 'op';
        const spanOpDuration = row[field];
        const widthPercentage = spanOpDuration / cumulativeSpanOpBreakdown;
        otherPercentage = otherPercentage - widthPercentage;
        if (widthPercentage === 0) {
          return null;
        }
        return (
          <div key={operationName} style={{width: toPercent(widthPercentage || 0)}}>
            <Tooltip
              title={
                <Fragment>
                  {operationName}
                  <br />
                  <Duration
                    seconds={spanOpDuration / 1000}
                    fixedDigits={2}
                    abbreviation
                  />
                </Fragment>
              }
              containerDisplayMode="block"
            >
              <RectangleRelativeOpsBreakdown
                style={{
                  backgroundColor: pickBarColor(operationName, theme),
                }}
              />
            </Tooltip>
          </div>
        );
      })}
      <div key="other" style={{width: toPercent(Math.max(otherPercentage, 0))}}>
        <Tooltip title={<div>{t('Other')}</div>} containerDisplayMode="block">
          <OtherRelativeOpsBreakdown />
        </Tooltip>
      </div>
    </RelativeOpsBreakdown>
  );
}

const StyledQuestionTooltip = styled(QuestionTooltip)`
  position: relative;
  top: 1px;
  left: 4px;
`;

const RelativeOpsBreakdown = styled('div')`
  position: relative;
  display: flex;
`;

const RectangleRelativeOpsBreakdown = styled(RowRectangle)`
  position: relative;
  width: 100%;
`;

const OtherRelativeOpsBreakdown = styled(RectangleRelativeOpsBreakdown)`
  background-color: ${p => p.theme.colors.gray100};
`;
