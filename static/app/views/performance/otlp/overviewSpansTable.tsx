import {Fragment} from 'react';
import {useTheme} from '@emotion/react';
import type {Location} from 'history';

import {LinkButton} from 'sentry/components/core/button/linkButton';
import Pagination, {type CursorHandler} from 'sentry/components/pagination';
import GridEditable from 'sentry/components/tables/gridEditable';
import {IconPlay, IconProfiling} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import type {Organization} from 'sentry/types/organization';
import type EventView from 'sentry/utils/discover/eventView';
import type {EventsMetaType} from 'sentry/utils/discover/eventView';
import {getFieldRenderer} from 'sentry/utils/discover/fieldRenderers';
import type {Theme} from 'sentry/utils/theme';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';
import useProjects from 'sentry/utils/useProjects';
import {renderHeadCell} from 'sentry/views/insights/common/components/tableCells/renderHeadCell';
import {SpanIdCell} from 'sentry/views/insights/common/components/tableCells/spanIdCell';
import {useEAPSpans} from 'sentry/views/insights/common/queries/useDiscover';
import {ModuleName} from 'sentry/views/insights/types';
import {TraceViewSources} from 'sentry/views/performance/newTraceDetails/traceHeader/breadcrumbs';
import {
  SERVICE_ENTRY_SPANS_COLUMN_ORDER,
  type ServiceEntrySpansColumn,
  type ServiceEntrySpansRow,
} from 'sentry/views/performance/otlp/types';
import {useServiceEntrySpansQuery} from 'sentry/views/performance/otlp/useServiceEntrySpansQuery';
import {SERVICE_ENTRY_SPANS_CURSOR} from 'sentry/views/performance/otlp/utils';

const LIMIT = 50;

type Props = {
  eventView: EventView;
  totalValues: Record<string, number> | null;
  transactionName: string;
};

export function OverviewSpansTable({eventView, totalValues, transactionName}: Props) {
  const {selection} = usePageFilters();
  const location = useLocation();
  const {projects} = useProjects();
  const navigate = useNavigate();
  const theme = useTheme();
  const organization = useOrganization();

  const projectSlug = projects.find(p => p.id === `${eventView.project}`)?.slug;

  const p95 = totalValues?.['p95()'] ?? 0;
  const defaultQuery = new MutableSearch('');
  defaultQuery.addFilterValue('is_transaction', '1');
  defaultQuery.addFilterValue('transaction', transactionName);

  const countQuery = new MutableSearch('');
  countQuery.addFilterValue('is_transaction', '1');
  countQuery.addFilterValue('transaction', transactionName);

  const {data: numEvents, error: numEventsError} = useEAPSpans(
    {
      search: countQuery,
      fields: ['count()'],
      pageFilters: selection,
    },
    'api.performance.service-entry-spans-table-count'
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
  } = useServiceEntrySpansQuery({
    query: defaultQuery.formatString(),
    sort: {
      field: 'span.duration',
      kind: 'desc',
    },
    transactionName,
    p95,
    limit: LIMIT,
  });

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
      query: {...query, [SERVICE_ENTRY_SPANS_CURSOR]: _cursor},
    });
  };

  return (
    <Fragment>
      <GridEditable
        isLoading={isLoading}
        error={error}
        data={consolidatedData}
        columnOrder={SERVICE_ENTRY_SPANS_COLUMN_ORDER}
        columnSortBy={[]}
        grid={{
          renderHeadCell: column =>
            renderHeadCell({
              column,
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
  column: ServiceEntrySpansColumn,
  row: ServiceEntrySpansRow,
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
