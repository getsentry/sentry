import {Fragment} from 'react';
import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';
import type {Location} from 'history';

import {LinkButton} from '@sentry/scraps/button';
import {Link} from '@sentry/scraps/link';
import {Tooltip} from '@sentry/scraps/tooltip';

import {Duration} from 'sentry/components/duration';
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
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';
import {useOrganization} from 'sentry/utils/useOrganization';
import {useProjects} from 'sentry/utils/useProjects';
import {renderHeadCell} from 'sentry/views/insights/common/components/tableCells/renderHeadCell';
import {SpanIdCell} from 'sentry/views/insights/common/components/tableCells/spanIdCell';
import {useSpans} from 'sentry/views/insights/common/queries/useDiscover';
import {QueryParameterNames} from 'sentry/views/insights/common/views/queryParameters';
import {ModuleName, type SpanProperty} from 'sentry/views/insights/types';
import {SEGMENT_SPANS_CURSOR} from 'sentry/views/performance/eap/utils';
import {TraceViewSources} from 'sentry/views/performance/newTraceDetails/traceHeader/breadcrumbs';
import {getTraceDetailsUrl} from 'sentry/views/performance/traceDetails/utils';

const LIMIT = 50;

const SPAN_OPS_BREAKDOWN_COLUMN_KEY = 'span_ops_breakdown.relative';

const BASE_FIELDS: SpanProperty[] = [
  'span_id',
  'user.id',
  'user.email',
  'user.username',
  'user.ip',
  'request.method',
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

type OverviewSpansColumn = GridColumnHeader<
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

const BASE_COLUMN_ORDER: OverviewSpansColumn[] = [
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
];

const REPLAY_COLUMN: OverviewSpansColumn = {
  key: 'replayId',
  name: t('Replay'),
  width: COL_WIDTH_UNDEFINED,
};

const PROFILE_COLUMN: OverviewSpansColumn = {
  key: 'profile.id',
  name: t('Profile'),
  width: COL_WIDTH_UNDEFINED,
};

type Props = {
  eventView: EventView;
  transactionName: string;
  maxDuration?: number;
};

export function OverviewSpansTable({eventView, transactionName, maxDuration}: Props) {
  const {selection} = usePageFilters();
  const location = useLocation();
  const {projects} = useProjects();
  const navigate = useNavigate();
  const theme = useTheme();
  const organization = useOrganization();

  const project = projects.find(p => p.id === `${eventView.project}`);
  const projectSlug = project?.slug;

  const showReplayColumn =
    organization.features.includes('session-replay') &&
    project !== undefined &&
    projectSupportsReplay(project);

  const fields = showReplayColumn ? BASE_FIELDS.concat('replayId') : BASE_FIELDS;

  const columnOrder: OverviewSpansColumn[] = [
    ...BASE_COLUMN_ORDER,
    ...(showReplayColumn ? [REPLAY_COLUMN] : []),
    PROFILE_COLUMN,
  ];

  const searchQuery = decodeScalar(location.query.query, '');
  const cursor = decodeScalar(location.query?.[SEGMENT_SPANS_CURSOR]);
  const sort = decodeSorts(location.query?.[QueryParameterNames.SPANS_SORT])[0] ?? {
    field: 'timestamp',
    kind: 'desc' as const,
  };

  const defaultQuery = new MutableSearch(searchQuery);
  defaultQuery.setFilterValues('is_transaction', ['true']);
  defaultQuery.setFilterValues('transaction', [transactionName]);
  if (maxDuration !== undefined && maxDuration > 0) {
    defaultQuery.setFilterValues('span.duration', [`<=${maxDuration.toFixed(0)}`]);
  }

  const countQuery = new MutableSearch(searchQuery);
  countQuery.setFilterValues('is_transaction', ['true']);
  countQuery.setFilterValues('transaction', [transactionName]);
  if (maxDuration !== undefined && maxDuration > 0) {
    countQuery.setFilterValues('span.duration', [`<=${maxDuration.toFixed(0)}`]);
  }

  const {data: numEvents, error: numEventsError} = useSpans(
    {
      search: countQuery,
      fields: ['count()'],
      pageFilters: selection,
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
      search: defaultQuery,
      fields,
      sorts: [sort],
      limit: LIMIT,
      cursor,
      pageFilters: selection,
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

  const handleCursor: CursorHandler = (_cursor, pathname, query) => {
    navigate({
      pathname,
      query: {...query, [SEGMENT_SPANS_CURSOR]: _cursor},
    });
  };

  return (
    <Fragment>
      <GridEditable
        isLoading={isLoading}
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
        onCursor={handleCursor}
        size="md"
        caption={numEventsError ? undefined : paginationCaption}
      />
    </Fragment>
  );
}

function renderBodyCell(
  column: OverviewSpansColumn,
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
        dateSelection: {},
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
            pathname: `/organizations/${organization.slug}/profiling/profile/${projectSlug}/${row['profile.id']}/flamegraph/`,
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
            pathname: `/organizations/${organization.slug}/replays/${row.replayId}/`,
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

  if (!meta || !meta?.fields) {
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
      <Duration
        seconds={(row['span.duration'] ?? 0) / 1000}
        fixedDigits={2}
        abbreviation
      />
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
                <div>
                  <div>{operationName}</div>
                  <div>
                    <Duration
                      seconds={spanOpDuration / 1000}
                      fixedDigits={2}
                      abbreviation
                    />
                  </div>
                </div>
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
