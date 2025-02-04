import type {Location} from 'history';
import {LinkButton} from 'sentry/components/button';

import GridEditable, {
  COL_WIDTH_UNDEFINED,
  type GridColumnHeader,
} from 'sentry/components/gridEditable';
import {IconPlay, IconProfiling} from 'sentry/icons';
import {t} from 'sentry/locale';
import type {Organization} from 'sentry/types/organization';
import type EventView from 'sentry/utils/discover/eventView';
import type {EventsMetaType} from 'sentry/utils/discover/eventView';
import {getFieldRenderer} from 'sentry/utils/discover/fieldRenderers';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import useProjects from 'sentry/utils/useProjects';
import {renderHeadCell} from 'sentry/views/insights/common/components/tableCells/renderHeadCell';
import {SpanIdCell} from 'sentry/views/insights/common/components/tableCells/spanIdCell';
import {useEAPSpans} from 'sentry/views/insights/common/queries/useDiscover';
import {type EAPSpanResponse, ModuleName} from 'sentry/views/insights/types';
import {TraceViewSources} from 'sentry/views/performance/newTraceDetails/traceHeader/breadcrumbs';

// TODO: When supported, also add span operation breakdown as a field
type Row = Pick<
  EAPSpanResponse,
  | 'span_id'
  | 'user.display'
  | 'user.id'
  | 'user.email'
  | 'user.username'
  | 'user.ip'
  | 'span.duration'
  | 'trace'
  | 'timestamp'
  | 'replay.id'
  | 'profile_id'
  | 'profiler.id'
  | 'thread.id'
  | 'precise.start_ts'
  | 'precise.finish_ts'
>;

type Column = GridColumnHeader<
  | 'span_id'
  | 'user.display'
  | 'span.duration'
  | 'trace'
  | 'timestamp'
  | 'replay.id'
  | 'profile_id'
>;

const COLUMN_ORDER: Column[] = [
  {
    key: 'trace',
    name: t('Trace ID'),
    width: COL_WIDTH_UNDEFINED,
  },
  {
    key: 'span_id',
    name: t('Span ID'),
    width: COL_WIDTH_UNDEFINED,
  },
  {
    key: 'user.display',
    name: t('User'),
    width: COL_WIDTH_UNDEFINED,
  },
  {
    key: 'span.duration',
    name: t('Total Duration'),
    width: COL_WIDTH_UNDEFINED,
  },
  {
    key: 'timestamp',
    name: t('Timestamp'),
    width: COL_WIDTH_UNDEFINED,
  },
  {
    key: 'replay.id',
    name: t('Replay'),
    width: COL_WIDTH_UNDEFINED,
  },
  {
    key: 'profile_id',
    name: t('Profile'),
    width: COL_WIDTH_UNDEFINED,
  },
];

const LIMIT = 5;

type Props = {
  eventView: EventView;
};

export function ServiceEntrySpansTable({eventView}: Props) {
  const location = useLocation();
  const organization = useOrganization();
  const {projects} = useProjects();

  const projectSlug = projects.find(p => p.id === `${eventView.project}`)?.slug;

  const {
    data: tableData,
    isLoading,
    pageLinks,
    meta,
    error,
  } = useEAPSpans(
    {
      search: eventView.query,
      fields: [
        'span_id',
        'user.id',
        'user.email',
        'user.username',
        'user.ip',
        'span.duration',
        'trace',
        'timestamp',
        'replay.id',
        'profile_id',
        'profiler.id',
        'thread.id',
        'precise.start_ts',
        'precise.finish_ts',
      ],
      limit: LIMIT,
    },
    'api.performance.service-entry-spans-table',
    true
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
    <GridEditable
      isLoading={isLoading}
      error={error}
      data={consolidatedData}
      columnOrder={COLUMN_ORDER}
      columnSortBy={[]}
      grid={{
        renderHeadCell: column =>
          renderHeadCell({
            column,
          }),
        renderBodyCell: (column, row) =>
          renderBodyCell(column, row, meta, projectSlug, location, organization),
      }}
    />
  );
}

function renderBodyCell(
  column: Column,
  row: Row,
  meta: EventsMetaType | undefined,
  projectSlug: string | undefined,
  location: Location,
  organization: Organization
) {
  if (column.key === 'span_id') {
    return (
      <SpanIdCell
        moduleName={ModuleName.OTHER}
        projectSlug={projectSlug ?? ''}
        traceId={row.trace}
        timestamp={row.timestamp}
        transactionId={row.span_id}
        spanId={row.span_id}
        source={TraceViewSources.PERFORMANCE_TRANSACTION_SUMMARY}
        location={location}
      />
    );
  }

  if (column.key === 'profile_id') {
    return (
      <div>
        <LinkButton
          size="xs"
          icon={<IconProfiling size="xs" />}
          to={{
            pathname: `/organizations/${organization.slug}/profiling/profile/${projectSlug}/${row.profile_id}/flamegraph/`,
            query: {
              referrer: 'performance',
            },
          }}
          aria-label={t('View Profile')}
          disabled={!row.profile_id}
        ></LinkButton>
      </div>
    );
  }

  if (column.key === 'replay.id') {
    return (
      <div>
        <LinkButton
          size="xs"
          icon={<IconPlay size="xs" />}
          to={{
            pathname: `/organizations/${organization.slug}/replays/${row['replay.id']}/`,
            query: {
              referrer: 'performance',
            },
          }}
          disabled={!row['replay.id']}
          aria-label={t('View Replay')}
        ></LinkButton>
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
    unit: meta.units?.[column.key],
  });

  return rendered;
}
