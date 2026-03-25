import {Fragment} from 'react';
import {useTheme} from '@emotion/react';
import type {Location} from 'history';

import {LinkButton} from '@sentry/scraps/button';
import {Link} from '@sentry/scraps/link';

import {usePageFilters} from 'sentry/components/pageFilters/usePageFilters';
import {Pagination, type CursorHandler} from 'sentry/components/pagination';
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
];

type OverviewSpansColumn = GridColumnHeader<
  | 'span_id'
  | 'request.method'
  | 'span.duration'
  | 'trace'
  | 'timestamp'
  | 'replayId'
  | 'profile.id'
>;

const BASE_COLUMN_ORDER: OverviewSpansColumn[] = [
  {key: 'trace', name: t('Trace ID'), width: COL_WIDTH_UNDEFINED},
  {key: 'span_id', name: t('Span ID'), width: COL_WIDTH_UNDEFINED},
  {key: 'request.method', name: t('HTTP Method'), width: COL_WIDTH_UNDEFINED},
  {key: 'span.duration', name: t('Total Duration'), width: COL_WIDTH_UNDEFINED},
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
};

export function OverviewSpansTable({eventView, transactionName}: Props) {
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

  const fields: SpanProperty[] = showReplayColumn
    ? BASE_FIELDS.concat('replayId')
    : BASE_FIELDS;

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

  const countQuery = new MutableSearch(searchQuery);
  countQuery.setFilterValues('is_transaction', ['true']);
  countQuery.setFilterValues('transaction', [transactionName]);

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
          renderHeadCell: column =>
            renderHeadCell({
              column,
              sort,
              location,
              sortParameterName: QueryParameterNames.SPANS_SORT,
            }),
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
