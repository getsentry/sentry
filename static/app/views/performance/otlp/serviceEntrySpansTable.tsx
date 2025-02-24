import {Fragment} from 'react';
import styled from '@emotion/styled';
import type {Location} from 'history';

import {Button, LinkButton} from 'sentry/components/button';
import {CompactSelect} from 'sentry/components/compactSelect';
import type {DropdownOption} from 'sentry/components/discover/transactionsList';
import {InvestigationRuleCreation} from 'sentry/components/dynamicSampling/investigationRule';
import GridEditable, {
  COL_WIDTH_UNDEFINED,
  type GridColumnHeader,
} from 'sentry/components/gridEditable';
import Pagination, {type CursorHandler} from 'sentry/components/pagination';
import {IconPlay, IconProfiling} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Organization} from 'sentry/types/organization';
import {parseCursor} from 'sentry/utils/cursor';
import type EventView from 'sentry/utils/discover/eventView';
import type {EventsMetaType} from 'sentry/utils/discover/eventView';
import {getFieldRenderer} from 'sentry/utils/discover/fieldRenderers';
import {decodeScalar} from 'sentry/utils/queryString';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';
import useOrganization from 'sentry/utils/useOrganization';
import useProjects from 'sentry/utils/useProjects';
import {renderHeadCell} from 'sentry/views/insights/common/components/tableCells/renderHeadCell';
import {SpanIdCell} from 'sentry/views/insights/common/components/tableCells/spanIdCell';
import {useEAPSpans} from 'sentry/views/insights/common/queries/useDiscover';
import {type EAPSpanResponse, ModuleName} from 'sentry/views/insights/types';
import {TraceViewSources} from 'sentry/views/performance/newTraceDetails/traceHeader/breadcrumbs';
import {
  filterToField,
  SpanOperationBreakdownFilter,
} from 'sentry/views/performance/transactionSummary/filter';
import {TransactionFilterOptions} from 'sentry/views/performance/transactionSummary/utils';

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
  | 'replayId'
  | 'profile.id'
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
  | 'replayId'
  | 'profile.id'
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
    key: 'replayId',
    name: t('Replay'),
    width: COL_WIDTH_UNDEFINED,
  },
  {
    key: 'profile.id',
    name: t('Profile'),
    width: COL_WIDTH_UNDEFINED,
  },
];

const LIMIT = 5;
const PAGINATION_CURSOR_SIZE = 'xs';
const CURSOR_NAME = 'serviceEntrySpansCursor';

type Props = {
  eventView: EventView;
  handleDropdownChange: (k: string) => void;
  spanOperationBreakdownFilter: SpanOperationBreakdownFilter;
  totalValues: Record<string, number> | null;
  transactionName: string;
  showViewSampledEventsButton?: boolean;
  supportsInvestigationRule?: boolean;
};

export function ServiceEntrySpansTable({
  eventView,
  handleDropdownChange,
  totalValues,
  spanOperationBreakdownFilter,
  transactionName,
  supportsInvestigationRule,
  showViewSampledEventsButton,
}: Props) {
  const location = useLocation();
  const organization = useOrganization();
  const {projects} = useProjects();
  const navigate = useNavigate();

  const projectSlug = projects.find(p => p.id === `${eventView.project}`)?.slug;
  const cursor = decodeScalar(location.query?.[CURSOR_NAME]);
  const {selected, options} = getOTelTransactionsListSort(location, {
    spanOperationBreakdownFilter,
    p95: totalValues?.['p95()'] ?? 0,
  });

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
        'replayId',
        'profile.id',
        'profiler.id',
        'thread.id',
        'precise.start_ts',
        'precise.finish_ts',
      ],
      sorts: [selected.sort],
      limit: LIMIT,
      cursor,
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

  const handleCursor: CursorHandler = (_cursor, pathname, query) => {
    navigate({
      pathname,
      query: {...query, [CURSOR_NAME]: _cursor},
    });
  };

  const cursorOffset = parseCursor(cursor)?.offset ?? 0;
  const totalNumSamples = cursorOffset;

  const handleViewSampledEvents = () => {
    if (!projectSlug) {
      return;
    }

    navigate({
      pathname: `${location.pathname}events/`,
      query: {
        ...location.query,
        transaction: transactionName,
        project: `${eventView.project}`,
      },
    });
  };

  return (
    <Fragment>
      <Header>
        <CompactSelect
          triggerProps={{prefix: t('Filter'), size: 'xs'}}
          value={selected.value}
          options={options}
          onChange={opt => handleDropdownChange(opt.value)}
        />
        <HeaderButtonWrapper>
          {supportsInvestigationRule && (
            <InvestigationRuleWrapper>
              <InvestigationRuleCreation
                buttonProps={{size: 'xs'}}
                eventView={eventView}
                numSamples={totalNumSamples}
              />
            </InvestigationRuleWrapper>
          )}
          {showViewSampledEventsButton && (
            <Button
              size="xs"
              data-test-id="transaction-events-open"
              onClick={handleViewSampledEvents}
            >
              {t('View Sampled Events')}
            </Button>
          )}
        </HeaderButtonWrapper>
        <CustomPagination
          pageLinks={pageLinks}
          onCursor={handleCursor}
          isLoading={isLoading}
        />
      </Header>

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
    </Fragment>
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
    unit: meta.units?.[column.key],
  });

  return rendered;
}

// A wrapper component that handles the isLoading state. This will allow the component to not disappear when the data is loading.
function CustomPagination({
  pageLinks,
  onCursor,
  isLoading,
}: {
  isLoading: boolean;
  onCursor: CursorHandler;
  pageLinks: string | undefined;
}) {
  if (isLoading) {
    return (
      <StyledPagination
        pageLinks={'n/a'}
        disabled
        onCursor={() => {}}
        size={PAGINATION_CURSOR_SIZE}
      />
    );
  }

  return (
    <StyledPagination
      pageLinks={pageLinks}
      onCursor={onCursor}
      size={PAGINATION_CURSOR_SIZE}
    />
  );
}

function getOTelFilterOptions({
  p95,
  spanOperationBreakdownFilter,
}: {
  p95: number;
  spanOperationBreakdownFilter: SpanOperationBreakdownFilter;
}): DropdownOption[] {
  if (spanOperationBreakdownFilter === SpanOperationBreakdownFilter.NONE) {
    return [
      {
        sort: {kind: 'asc', field: 'span.duration'},
        value: TransactionFilterOptions.FASTEST,
        label: t('Fastest Transactions'),
      },
      {
        query: p95 > 0 ? [['span.duration', `<=${p95.toFixed(0)}`]] : undefined,
        sort: {kind: 'desc', field: 'span.duration'},
        value: TransactionFilterOptions.SLOW,
        label: t('Slow Transactions (p95)'),
      },
      {
        sort: {kind: 'desc', field: 'span.duration'},
        value: TransactionFilterOptions.OUTLIER,
        label: t('Outlier Transactions (p100)'),
      },
      {
        sort: {kind: 'desc', field: 'timestamp'},
        value: TransactionFilterOptions.RECENT,
        label: t('Recent Transactions'),
      },
    ];
  }

  const field = filterToField(spanOperationBreakdownFilter)!;
  const operationName = spanOperationBreakdownFilter;

  return [
    {
      sort: {kind: 'asc', field},
      value: TransactionFilterOptions.FASTEST,
      label: t('Fastest %s Operations', operationName),
    },
    {
      query: p95 > 0 ? [['transaction.duration', `<=${p95.toFixed(0)}`]] : undefined,
      sort: {kind: 'desc', field},
      value: TransactionFilterOptions.SLOW,
      label: t('Slow %s Operations (p95)', operationName),
    },
    {
      sort: {kind: 'desc', field},
      value: TransactionFilterOptions.OUTLIER,
      label: t('Outlier %s Operations (p100)', operationName),
    },
    {
      sort: {kind: 'desc', field: 'timestamp'},
      value: TransactionFilterOptions.RECENT,
      label: t('Recent Transactions'),
    },
  ];
}

function getOTelTransactionsListSort(
  location: Location,
  options: {p95: number; spanOperationBreakdownFilter: SpanOperationBreakdownFilter}
): {options: DropdownOption[]; selected: DropdownOption} {
  const sortOptions = getOTelFilterOptions(options);
  const urlParam = decodeScalar(
    location.query.showTransactions,
    TransactionFilterOptions.SLOW
  );
  const selectedSort = sortOptions.find(opt => opt.value === urlParam) || sortOptions[0]!;
  return {selected: selectedSort, options: sortOptions};
}

const Header = styled('div')`
  display: grid;
  grid-template-columns: 1fr auto auto auto;
  margin-bottom: ${space(1)};
  align-items: center;
`;

const StyledPagination = styled(Pagination)`
  margin: 0 0 0 ${space(1)};
`;

const HeaderButtonWrapper = styled('div')`
  display: flex;
`;

const InvestigationRuleWrapper = styled('div')`
  margin-right: ${space(1)};
`;
