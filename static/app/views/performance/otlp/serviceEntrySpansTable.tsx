import {Fragment} from 'react';
import {useTheme, type Theme} from '@emotion/react';
import styled from '@emotion/styled';
import type {Location} from 'history';

import {Flex} from '@sentry/scraps/layout';
import {OverlayTrigger} from '@sentry/scraps/overlayTrigger';

import {Button} from 'sentry/components/core/button';
import {LinkButton} from 'sentry/components/core/button/linkButton';
import {CompactSelect} from 'sentry/components/core/compactSelect';
import {InvestigationRuleCreation} from 'sentry/components/dynamicSampling/investigationRule';
import Pagination, {type CursorHandler} from 'sentry/components/pagination';
import GridEditable from 'sentry/components/tables/gridEditable';
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
import {ModuleName, SpanFields} from 'sentry/views/insights/types';
import {TraceViewSources} from 'sentry/views/performance/newTraceDetails/traceHeader/breadcrumbs';
import {
  SERVICE_ENTRY_SPANS_COLUMN_ORDER,
  type ServiceEntrySpansColumn,
  type ServiceEntrySpansRow,
} from 'sentry/views/performance/otlp/types';
import {useServiceEntrySpansQuery} from 'sentry/views/performance/otlp/useServiceEntrySpansQuery';
import {
  getOTelTransactionsListSort,
  SERVICE_ENTRY_SPANS_CURSOR,
} from 'sentry/views/performance/otlp/utils';
import {TransactionFilterOptions} from 'sentry/views/performance/transactionSummary/utils';

const LIMIT = 5;
const PAGINATION_CURSOR_SIZE = 'xs';

type Props = {
  eventView: EventView;
  handleDropdownChange: (k: string) => void;
  totalValues: Record<string, number> | null;
  transactionName: string;
  showViewSampledEventsButton?: boolean;
  supportsInvestigationRule?: boolean;
};

export function ServiceEntrySpansTable({
  eventView,
  handleDropdownChange,
  totalValues,
  transactionName,
  supportsInvestigationRule,
  showViewSampledEventsButton,
}: Props) {
  const theme = useTheme();
  const location = useLocation();
  const organization = useOrganization();
  const {projects} = useProjects();
  const navigate = useNavigate();

  const projectSlug = projects.find(p => p.id === `${eventView.project}`)?.slug;
  const cursor = decodeScalar(location.query?.[SERVICE_ENTRY_SPANS_CURSOR]);
  const spanCategory = decodeScalar(location.query?.[SpanFields.SPAN_CATEGORY]);
  const {selected, options} = getOTelTransactionsListSort(location, spanCategory);

  const p95 = totalValues?.['p95()'] ?? 0;
  const eventViewQuery = new MutableSearch('');
  if (selected.value === TransactionFilterOptions.SLOW && p95) {
    eventViewQuery.addFilterValue('span.duration', `<=${p95.toFixed(0)}`);
  }

  const {
    data: tableData,
    isLoading,
    pageLinks,
    meta,
    error,
  } = useServiceEntrySpansQuery({
    query: eventViewQuery.formatString(),
    sort: selected.sort,
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
          trigger={triggerProps => (
            <OverlayTrigger.Button {...triggerProps} prefix={t('Filter')} size="xs" />
          )}
          value={selected.value}
          options={options}
          onChange={opt => handleDropdownChange(opt.value)}
        />
        <Flex>
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
        </Flex>
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
        pageLinks="n/a"
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

const Header = styled('div')`
  display: grid;
  grid-template-columns: 1fr auto auto auto;
  margin-bottom: ${space(1)};
  align-items: center;
`;

const StyledPagination = styled(Pagination)`
  margin: 0 0 0 ${space(1)};
`;

const InvestigationRuleWrapper = styled('div')`
  margin-right: ${space(1)};
`;
