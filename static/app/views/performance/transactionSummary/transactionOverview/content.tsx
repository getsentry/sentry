import * as React from 'react';
import {browserHistory} from 'react-router';
import styled from '@emotion/styled';
import {Location} from 'history';
import omit from 'lodash/omit';

import Feature from 'sentry/components/acl/feature';
import TransactionsList, {
  DropdownOption,
} from 'sentry/components/discover/transactionsList';
import SearchBar from 'sentry/components/events/searchBar';
import * as Layout from 'sentry/components/layouts/thirds';
import {normalizeDateTimeParams} from 'sentry/components/organizations/pageFilters/parse';
import {MAX_QUERY_LENGTH} from 'sentry/constants';
import {t} from 'sentry/locale';
import space from 'sentry/styles/space';
import {Organization, Project} from 'sentry/types';
import {defined, generateQueryWithTag} from 'sentry/utils';
import {trackAnalyticsEvent} from 'sentry/utils/analytics';
import EventView from 'sentry/utils/discover/eventView';
import {
  formatTagKey,
  getAggregateAlias,
  isRelativeSpanOperationBreakdownField,
  SPAN_OP_BREAKDOWN_FIELDS,
  SPAN_OP_RELATIVE_BREAKDOWN_FIELD,
} from 'sentry/utils/discover/fields';
import {decodeScalar} from 'sentry/utils/queryString';
import withProjects from 'sentry/utils/withProjects';
import {Actions, updateQuery} from 'sentry/views/eventsV2/table/cellAction';
import {TableColumn} from 'sentry/views/eventsV2/table/types';
import Tags from 'sentry/views/eventsV2/tags';
import {
  PERCENTILE as VITAL_PERCENTILE,
  VITAL_GROUPS,
} from 'sentry/views/performance/transactionSummary/transactionVitals/constants';

import MetricsSearchBar from '../../metricsSearchBar';
import {isSummaryViewFrontend, isSummaryViewFrontendPageLoad} from '../../utils';
import Filter, {
  decodeFilterFromLocation,
  filterToField,
  filterToSearchConditions,
  SpanOperationBreakdownFilter,
} from '../filter';
import {
  generateTraceLink,
  generateTransactionLink,
  normalizeSearchConditions,
  SidebarSpacer,
  TransactionFilterOptions,
} from '../utils';

import TransactionSummaryCharts from './charts';
import RelatedIssues from './relatedIssues';
import SidebarCharts from './sidebarCharts';
import StatusBreakdown from './statusBreakdown';
import SuspectSpans from './suspectSpans';
import {TagExplorer} from './tagExplorer';
import UserStats from './userStats';

type Props = {
  error: string | null;
  eventView: EventView;
  isLoading: boolean;
  location: Location;
  onChangeFilter: (newFilter: SpanOperationBreakdownFilter) => void;
  organization: Organization;
  projectId: string;
  projects: Project[];
  spanOperationBreakdownFilter: SpanOperationBreakdownFilter;
  totalValues: Record<string, number> | null;
  transactionName: string;
  isMetricsData?: boolean;
};

function SummaryContent({
  eventView,
  location,
  totalValues,
  spanOperationBreakdownFilter,
  organization,
  projects,
  isLoading,
  error,
  projectId,
  transactionName,
  onChangeFilter,
  isMetricsData,
}: Props) {
  function handleSearch(query: string) {
    const queryParams = normalizeDateTimeParams({
      ...(location.query || {}),
      query,
    });

    // do not propagate pagination when making a new search
    const searchQueryParams = omit(queryParams, 'cursor');

    browserHistory.push({
      pathname: location.pathname,
      query: searchQueryParams,
    });
  }

  function generateTagUrl(key: string, value: string) {
    const query = generateQueryWithTag(location.query, {key: formatTagKey(key), value});

    return {
      ...location,
      query,
    };
  }

  function handleCellAction(column: TableColumn<React.ReactText>) {
    return (action: Actions, value: React.ReactText) => {
      const searchConditions = normalizeSearchConditions(eventView.query);

      updateQuery(searchConditions, action, column, value);

      browserHistory.push({
        pathname: location.pathname,
        query: {
          ...location.query,
          cursor: undefined,
          query: searchConditions.formatString(),
        },
      });
    };
  }

  function handleTransactionsListSortChange(value: string) {
    const target = {
      pathname: location.pathname,
      query: {...location.query, showTransactions: value, transactionCursor: undefined},
    };

    browserHistory.push(target);
  }

  function handleAllEventsViewClick() {
    trackAnalyticsEvent({
      eventKey: 'performance_views.summary.view_in_transaction_events',
      eventName: 'Performance Views: View in All Events from Transaction Summary',
      organization_id: parseInt(organization.id, 10),
    });
  }

  function generateEventView(
    transactionsListEventView: EventView,
    transactionsListTitles: string[]
  ) {
    const {selected} = getTransactionsListSort(location, {
      p95: totalValues?.p95 ?? 0,
      spanOperationBreakdownFilter,
    });
    const sortedEventView = transactionsListEventView.withSorts([selected.sort]);

    if (spanOperationBreakdownFilter === SpanOperationBreakdownFilter.None) {
      const fields = [
        // Remove the extra field columns
        ...sortedEventView.fields.slice(0, transactionsListTitles.length),
      ];

      // omit "Operation Duration" column
      sortedEventView.fields = fields.filter(({field}) => {
        return !isRelativeSpanOperationBreakdownField(field);
      });
    }
    return sortedEventView;
  }

  const hasPerformanceChartInterpolation = organization.features.includes(
    'performance-chart-interpolation'
  );

  const query = decodeScalar(location.query.query, '');
  const totalCount = totalValues === null ? null : totalValues.count;

  // NOTE: This is not a robust check for whether or not a transaction is a front end
  // transaction, however it will suffice for now.
  const hasWebVitals =
    isSummaryViewFrontendPageLoad(eventView, projects) ||
    (totalValues !== null &&
      VITAL_GROUPS.some(group =>
        group.vitals.some(vital => {
          const alias = getAggregateAlias(`percentile(${vital}, ${VITAL_PERCENTILE})`);
          return Number.isFinite(totalValues[alias]);
        })
      ));

  const isFrontendView = isSummaryViewFrontend(eventView, projects);

  const transactionsListTitles = [
    t('event id'),
    t('user'),
    t('total duration'),
    t('trace id'),
    t('timestamp'),
  ];

  let transactionsListEventView = eventView.clone();

  if (organization.features.includes('performance-ops-breakdown')) {
    // update search conditions

    const spanOperationBreakdownConditions = filterToSearchConditions(
      spanOperationBreakdownFilter,
      location
    );

    if (spanOperationBreakdownConditions) {
      eventView = eventView.clone();
      eventView.query = `${eventView.query} ${spanOperationBreakdownConditions}`.trim();
      transactionsListEventView = eventView.clone();
    }

    // update header titles of transactions list

    const operationDurationTableTitle =
      spanOperationBreakdownFilter === SpanOperationBreakdownFilter.None
        ? t('operation duration')
        : `${spanOperationBreakdownFilter} duration`;

    // add ops breakdown duration column as the 3rd column
    transactionsListTitles.splice(2, 0, operationDurationTableTitle);

    // span_ops_breakdown.relative is a preserved name and a marker for the associated
    // field renderer to be used to generate the relative ops breakdown
    let durationField = SPAN_OP_RELATIVE_BREAKDOWN_FIELD;

    if (spanOperationBreakdownFilter !== SpanOperationBreakdownFilter.None) {
      durationField = filterToField(spanOperationBreakdownFilter)!;
    }

    const fields = [...transactionsListEventView.fields];

    // add ops breakdown duration column as the 3rd column
    fields.splice(2, 0, {field: durationField});

    if (spanOperationBreakdownFilter === SpanOperationBreakdownFilter.None) {
      fields.push(
        ...SPAN_OP_BREAKDOWN_FIELDS.map(field => {
          return {field};
        })
      );
    }

    transactionsListEventView.fields = fields;
  }

  const openAllEventsProps = {
    generatePerformanceTransactionEventsView: () => {
      const performanceTransactionEventsView = generateEventView(
        transactionsListEventView,
        transactionsListTitles
      );
      performanceTransactionEventsView.query = query;
      return performanceTransactionEventsView;
    },
    handleOpenAllEventsClick: handleAllEventsViewClick,
  };

  return (
    <React.Fragment>
      <Layout.Main>
        <Search>
          <Filter
            organization={organization}
            currentFilter={spanOperationBreakdownFilter}
            onChangeFilter={onChangeFilter}
          />
          <SearchBarContainer>
            {isMetricsData ? (
              <MetricsSearchBar
                searchSource="transaction_summary_metrics"
                orgSlug={organization.slug}
                projectIds={eventView.project}
                query={query}
                onSearch={handleSearch}
                maxQueryLength={MAX_QUERY_LENGTH}
              />
            ) : (
              <SearchBar
                searchSource="transaction_summary"
                organization={organization}
                projectIds={eventView.project}
                query={query}
                fields={eventView.fields}
                onSearch={handleSearch}
                maxQueryLength={MAX_QUERY_LENGTH}
              />
            )}
          </SearchBarContainer>
        </Search>
        <TransactionSummaryCharts
          organization={organization}
          location={location}
          eventView={eventView}
          totalValues={totalCount}
          currentFilter={spanOperationBreakdownFilter}
          withoutZerofill={hasPerformanceChartInterpolation}
        />
        <TransactionsList
          location={location}
          organization={organization}
          eventView={transactionsListEventView}
          {...openAllEventsProps}
          showTransactions={
            decodeScalar(
              location.query.showTransactions,
              TransactionFilterOptions.SLOW
            ) as TransactionFilterOptions
          }
          breakdown={decodeFilterFromLocation(location)}
          titles={transactionsListTitles}
          handleDropdownChange={handleTransactionsListSortChange}
          generateLink={{
            id: generateTransactionLink(transactionName),
            trace: generateTraceLink(eventView.normalizeDateSelection(location)),
          }}
          handleCellAction={handleCellAction}
          {...getTransactionsListSort(location, {
            p95: totalValues?.p95 ?? 0,
            spanOperationBreakdownFilter,
          })}
          forceLoading={isLoading}
        />
        <Feature
          requireAll={false}
          features={['organizations:performance-suspect-spans-view']}
        >
          <SuspectSpans
            location={location}
            organization={organization}
            eventView={eventView}
            totals={defined(totalValues?.count) ? {count: totalValues!.count} : null}
            projectId={projectId}
            transactionName={transactionName}
          />
        </Feature>
        <TagExplorer
          eventView={eventView}
          organization={organization}
          location={location}
          projects={projects}
          transactionName={transactionName}
          currentFilter={spanOperationBreakdownFilter}
        />
        <RelatedIssues
          organization={organization}
          location={location}
          transaction={transactionName}
          start={eventView.start}
          end={eventView.end}
          statsPeriod={eventView.statsPeriod}
        />
      </Layout.Main>
      <Layout.Side>
        <UserStats
          organization={organization}
          location={location}
          isLoading={isLoading}
          hasWebVitals={hasWebVitals}
          error={error}
          totals={totalValues}
          transactionName={transactionName}
          eventView={eventView}
          isMetricsData={isMetricsData}
        />
        {!isFrontendView && (
          <StatusBreakdown
            eventView={eventView}
            organization={organization}
            location={location}
          />
        )}
        <SidebarSpacer />
        <SidebarCharts
          organization={organization}
          isLoading={isLoading}
          error={error}
          totals={totalValues}
          eventView={eventView}
          isMetricsData={isMetricsData}
          transactionName={transactionName}
        />
        <SidebarSpacer />
        <Tags
          generateUrl={generateTagUrl}
          totalValues={totalCount}
          eventView={eventView}
          organization={organization}
          location={location}
        />
      </Layout.Side>
    </React.Fragment>
  );
}

function getFilterOptions({
  p95,
  spanOperationBreakdownFilter,
}: {
  p95: number;
  spanOperationBreakdownFilter: SpanOperationBreakdownFilter;
}): DropdownOption[] {
  if (spanOperationBreakdownFilter === SpanOperationBreakdownFilter.None) {
    return [
      {
        sort: {kind: 'asc', field: 'transaction.duration'},
        value: TransactionFilterOptions.FASTEST,
        label: t('Fastest Transactions'),
      },
      {
        query: [['transaction.duration', `<=${p95.toFixed(0)}`]],
        sort: {kind: 'desc', field: 'transaction.duration'},
        value: TransactionFilterOptions.SLOW,
        label: t('Slow Transactions (p95)'),
      },
      {
        sort: {kind: 'desc', field: 'transaction.duration'},
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
      query: [['transaction.duration', `<=${p95.toFixed(0)}`]],
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

function getTransactionsListSort(
  location: Location,
  options: {p95: number; spanOperationBreakdownFilter: SpanOperationBreakdownFilter}
): {options: DropdownOption[]; selected: DropdownOption} {
  const sortOptions = getFilterOptions(options);
  const urlParam = decodeScalar(
    location.query.showTransactions,
    TransactionFilterOptions.SLOW
  );
  const selectedSort = sortOptions.find(opt => opt.value === urlParam) || sortOptions[0];
  return {selected: selectedSort, options: sortOptions};
}

const Search = styled('div')`
  display: flex;
  width: 100%;
  margin-bottom: ${space(3)};
`;

const SearchBarContainer = styled('div')`
  flex-grow: 1;
`;

export default withProjects(SummaryContent);
