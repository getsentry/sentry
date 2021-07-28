import * as React from 'react';
import {browserHistory} from 'react-router';
import styled from '@emotion/styled';
import {Location} from 'history';
import omit from 'lodash/omit';

import Feature from 'app/components/acl/feature';
import {CreateAlertFromViewButton} from 'app/components/createAlertButton';
import TransactionsList, {DropdownOption} from 'app/components/discover/transactionsList';
import SearchBar from 'app/components/events/searchBar';
import GlobalSdkUpdateAlert from 'app/components/globalSdkUpdateAlert';
import * as Layout from 'app/components/layouts/thirds';
import {getParams} from 'app/components/organizations/globalSelectionHeader/getParams';
import {MAX_QUERY_LENGTH} from 'app/constants';
import {t} from 'app/locale';
import space from 'app/styles/space';
import {Organization, Project} from 'app/types';
import {generateQueryWithTag} from 'app/utils';
import {trackAnalyticsEvent} from 'app/utils/analytics';
import EventView from 'app/utils/discover/eventView';
import {
  getAggregateAlias,
  isRelativeSpanOperationBreakdownField,
  SPAN_OP_BREAKDOWN_FIELDS,
  SPAN_OP_RELATIVE_BREAKDOWN_FIELD,
} from 'app/utils/discover/fields';
import {decodeScalar} from 'app/utils/queryString';
import {tokenizeSearch} from 'app/utils/tokenizeSearch';
import withProjects from 'app/utils/withProjects';
import {Actions, updateQuery} from 'app/views/eventsV2/table/cellAction';
import {TableColumn} from 'app/views/eventsV2/table/types';
import Tags from 'app/views/eventsV2/tags';
import {
  PERCENTILE as VITAL_PERCENTILE,
  VITAL_GROUPS,
} from 'app/views/performance/transactionSummary/transactionVitals/constants';

import {isSummaryViewFrontendPageLoad} from '../utils';

import TransactionSummaryCharts from './charts';
import Filter, {
  decodeFilterFromLocation,
  filterToField,
  filterToSearchConditions,
  SpanOperationBreakdownFilter,
} from './filter';
import TransactionHeader, {Tab} from './header';
import RelatedIssues from './relatedIssues';
import SidebarCharts from './sidebarCharts';
import StatusBreakdown from './statusBreakdown';
import {TagExplorer} from './tagExplorer';
import {TransactionThresholdMetric} from './transactionThresholdModal';
import UserStats from './userStats';
import {
  generateTraceLink,
  generateTransactionLink,
  SidebarSpacer,
  TransactionFilterOptions,
} from './utils';

type Props = {
  location: Location;
  eventView: EventView;
  transactionName: string;
  organization: Organization;
  isLoading: boolean;
  error: string | null;
  totalValues: Record<string, number> | null;
  projects: Project[];
  onChangeFilter: (newFilter: SpanOperationBreakdownFilter) => void;
  onChangeThreshold?: (threshold: number, metric: TransactionThresholdMetric) => void;
  spanOperationBreakdownFilter: SpanOperationBreakdownFilter;
};

type State = {
  incompatibleAlertNotice: React.ReactNode;
};

class SummaryContent extends React.Component<Props, State> {
  state: State = {
    incompatibleAlertNotice: null,
  };

  handleSearch = (query: string) => {
    const {location} = this.props;

    const queryParams = getParams({
      ...(location.query || {}),
      query,
    });

    // do not propagate pagination when making a new search
    const searchQueryParams = omit(queryParams, 'cursor');

    browserHistory.push({
      pathname: location.pathname,
      query: searchQueryParams,
    });
  };

  generateTagUrl = (key: string, value: string) => {
    const {location} = this.props;
    const query = generateQueryWithTag(location.query, {key, value});

    return {
      ...location,
      query,
    };
  };

  handleIncompatibleQuery: React.ComponentProps<
    typeof CreateAlertFromViewButton
  >['onIncompatibleQuery'] = (incompatibleAlertNoticeFn, _errors) => {
    const incompatibleAlertNotice = incompatibleAlertNoticeFn(() =>
      this.setState({incompatibleAlertNotice: null})
    );
    this.setState({incompatibleAlertNotice});
  };

  handleCellAction = (column: TableColumn<React.ReactText>) => {
    return (action: Actions, value: React.ReactText) => {
      const {eventView, location} = this.props;

      const searchConditions = tokenizeSearch(eventView.query);

      // remove any event.type queries since it is implied to apply to only transactions
      searchConditions.removeTag('event.type');

      // no need to include transaction as its already in the query params
      searchConditions.removeTag('transaction');

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
  };

  handleTransactionsListSortChange = (value: string) => {
    const {location} = this.props;
    const target = {
      pathname: location.pathname,
      query: {...location.query, showTransactions: value, transactionCursor: undefined},
    };
    browserHistory.push(target);
  };

  handleAllEventsViewClick = () => {
    const {organization} = this.props;
    trackAnalyticsEvent({
      eventKey: 'performance_views.summary.view_in_transaction_events',
      eventName: 'Performance Views: View in All Events from Transaction Summary',
      organization_id: parseInt(organization.id, 10),
    });
  };

  handleDiscoverViewClick = () => {
    const {organization} = this.props;
    trackAnalyticsEvent({
      eventKey: 'performance_views.summary.view_in_discover',
      eventName: 'Performance Views: View in Discover from Transaction Summary',
      organization_id: parseInt(organization.id, 10),
    });
  };

  handleViewDetailsClick = (_e: React.MouseEvent<Element>) => {
    const {organization} = this.props;
    trackAnalyticsEvent({
      eventKey: 'performance_views.summary.view_details',
      eventName: 'Performance Views: View Details from Transaction Summary',
      organization_id: parseInt(organization.id, 10),
    });
  };

  generateEventView(
    transactionsListEventView: EventView,
    transactionsListTitles: string[]
  ) {
    const {location, totalValues, spanOperationBreakdownFilter} = this.props;
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

  render() {
    let {eventView} = this.props;
    const {
      transactionName,
      location,
      organization,
      projects,
      isLoading,
      error,
      totalValues,
      onChangeFilter,
      onChangeThreshold,
      spanOperationBreakdownFilter,
    } = this.props;
    const hasPerformanceEventsPage = organization.features.includes(
      'performance-events-page'
    );

    const {incompatibleAlertNotice} = this.state;
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
        const performanceTransactionEventsView = this.generateEventView(
          transactionsListEventView,
          transactionsListTitles
        );
        performanceTransactionEventsView.query = query;
        return performanceTransactionEventsView;
      },
      handleOpenAllEventsClick: this.handleAllEventsViewClick,
    };

    const openInDiscoverProps = {
      generateDiscoverEventView: () =>
        this.generateEventView(transactionsListEventView, transactionsListTitles),
      handleOpenInDiscoverClick: this.handleDiscoverViewClick,
    };

    return (
      <React.Fragment>
        <TransactionHeader
          eventView={eventView}
          location={location}
          organization={organization}
          projects={projects}
          transactionName={transactionName}
          currentTab={Tab.TransactionSummary}
          hasWebVitals={hasWebVitals}
          handleIncompatibleQuery={this.handleIncompatibleQuery}
          onChangeThreshold={onChangeThreshold}
        />
        <Layout.Body>
          <StyledSdkUpdatesAlert />
          {incompatibleAlertNotice && (
            <Layout.Main fullWidth>{incompatibleAlertNotice}</Layout.Main>
          )}
          <Layout.Main>
            <Search>
              <Filter
                organization={organization}
                currentFilter={spanOperationBreakdownFilter}
                onChangeFilter={onChangeFilter}
              />
              <StyledSearchBar
                searchSource="transaction_summary"
                organization={organization}
                projectIds={eventView.project}
                query={query}
                fields={eventView.fields}
                onSearch={this.handleSearch}
                maxQueryLength={MAX_QUERY_LENGTH}
              />
            </Search>
            <TransactionSummaryCharts
              organization={organization}
              location={location}
              eventView={eventView}
              totalValues={totalCount}
              currentFilter={spanOperationBreakdownFilter}
            />
            <TransactionsList
              location={location}
              organization={organization}
              eventView={transactionsListEventView}
              {...(hasPerformanceEventsPage ? openAllEventsProps : openInDiscoverProps)}
              showTransactions={
                decodeScalar(
                  location.query.showTransactions,
                  TransactionFilterOptions.SLOW
                ) as TransactionFilterOptions
              }
              breakdown={decodeFilterFromLocation(location)}
              titles={transactionsListTitles}
              handleDropdownChange={this.handleTransactionsListSortChange}
              generateLink={{
                id: generateTransactionLink(transactionName),
                trace: generateTraceLink(eventView.normalizeDateSelection(location)),
              }}
              baseline={transactionName}
              handleBaselineClick={this.handleViewDetailsClick}
              handleCellAction={this.handleCellAction}
              {...getTransactionsListSort(location, {
                p95: totalValues?.p95 ?? 0,
                spanOperationBreakdownFilter,
              })}
              forceLoading={isLoading}
            />
            <Feature
              requireAll={false}
              features={['performance-tag-explorer', 'performance-tag-page']}
            >
              <TagExplorer
                eventView={eventView}
                organization={organization}
                location={location}
                projects={projects}
                transactionName={transactionName}
                currentFilter={spanOperationBreakdownFilter}
              />
            </Feature>
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
            />
            <StatusBreakdown
              eventView={eventView}
              organization={organization}
              location={location}
            />
            <SidebarSpacer />
            <SidebarCharts
              organization={organization}
              isLoading={isLoading}
              error={error}
              totals={totalValues}
              eventView={eventView}
            />
            <SidebarSpacer />
            <Tags
              generateUrl={this.generateTagUrl}
              totalValues={totalCount}
              eventView={eventView}
              organization={organization}
              location={location}
            />
          </Layout.Side>
        </Layout.Body>
      </React.Fragment>
    );
  }
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
): {selected: DropdownOption; options: DropdownOption[]} {
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

const StyledSearchBar = styled(SearchBar)`
  flex-grow: 1;
`;

const StyledSdkUpdatesAlert = styled(GlobalSdkUpdateAlert)`
  @media (min-width: ${p => p.theme.breakpoints[1]}) {
    margin-bottom: 0;
  }
`;

StyledSdkUpdatesAlert.defaultProps = {
  Wrapper: p => <Layout.Main fullWidth {...p} />,
};

export default withProjects(SummaryContent);
