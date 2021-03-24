import React from 'react';
import {browserHistory} from 'react-router';
import styled from '@emotion/styled';
import {Location, LocationDescriptor, Query} from 'history';
import omit from 'lodash/omit';

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
import {TableDataRow} from 'app/utils/discover/discoverQuery';
import EventView from 'app/utils/discover/eventView';
import {getAggregateAlias} from 'app/utils/discover/fields';
import {generateEventSlug} from 'app/utils/discover/urls';
import {decodeScalar} from 'app/utils/queryString';
import {stringifyQueryObject, tokenizeSearch} from 'app/utils/tokenizeSearch';
import withProjects from 'app/utils/withProjects';
import {Actions, updateQuery} from 'app/views/eventsV2/table/cellAction';
import {TableColumn} from 'app/views/eventsV2/table/types';
import Tags from 'app/views/eventsV2/tags';
import {getTraceDetailsUrl} from 'app/views/performance/traceDetails/utils';
import {
  PERCENTILE as VITAL_PERCENTILE,
  VITAL_GROUPS,
} from 'app/views/performance/transactionVitals/constants';

import {getTransactionDetailsUrl} from '../utils';

import TransactionSummaryCharts from './charts';
import TransactionHeader, {Tab} from './header';
import RelatedIssues from './relatedIssues';
import SidebarCharts from './sidebarCharts';
import StatusBreakdown from './statusBreakdown';
import UserStats from './userStats';
import {SidebarSpacer, TransactionFilterOptions} from './utils';

type Props = {
  location: Location;
  eventView: EventView;
  transactionName: string;
  organization: Organization;
  isLoading: boolean;
  error: string | null;
  totalValues: Record<string, number> | null;
  projects: Project[];
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

      updateQuery(searchConditions, action, column.name, value);

      browserHistory.push({
        pathname: location.pathname,
        query: {
          ...location.query,
          cursor: undefined,
          query: stringifyQueryObject(searchConditions),
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

  render() {
    const {
      transactionName,
      location,
      eventView,
      organization,
      projects,
      isLoading,
      error,
      totalValues,
    } = this.props;
    const {incompatibleAlertNotice} = this.state;
    const query = decodeScalar(location.query.query, '');
    const totalCount = totalValues === null ? null : totalValues.count;

    // NOTE: This is not a robust check for whether or not a transaction is a front end
    // transaction, however it will suffice for now.
    const hasWebVitals =
      totalValues !== null &&
      VITAL_GROUPS.some(group =>
        group.vitals.some(vital => {
          const alias = getAggregateAlias(`percentile(${vital}, ${VITAL_PERCENTILE})`);
          return Number.isFinite(totalValues[alias]);
        })
      );

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
        />
        <Layout.Body>
          <StyledSdkUpdatesAlert />
          {incompatibleAlertNotice && (
            <Layout.Main fullWidth>{incompatibleAlertNotice}</Layout.Main>
          )}
          <Layout.Main>
            <StyledSearchBar
              organization={organization}
              projectIds={eventView.project}
              query={query}
              fields={eventView.fields}
              onSearch={this.handleSearch}
              maxQueryLength={MAX_QUERY_LENGTH}
            />
            <TransactionSummaryCharts
              organization={organization}
              location={location}
              eventView={eventView}
              totalValues={totalCount}
            />
            <TransactionsList
              location={location}
              organization={organization}
              eventView={eventView}
              titles={
                organization.features.includes('trace-view-summary')
                  ? [t('id'), t('user'), t('duration'), t('trace id'), t('timestamp')]
                  : [t('id'), t('user'), t('duration'), t('timestamp')]
              }
              handleDropdownChange={this.handleTransactionsListSortChange}
              generateLink={{
                id: generateTransactionLink(transactionName),
                trace: generateTraceLink(eventView.normalizeDateSelection(location)),
              }}
              baseline={transactionName}
              handleBaselineClick={this.handleViewDetailsClick}
              handleCellAction={this.handleCellAction}
              handleOpenInDiscoverClick={this.handleDiscoverViewClick}
              {...getTransactionsListSort(location, {
                p95: totalValues?.p95 ?? 0,
              })}
              forceLoading={isLoading}
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

function generateTraceLink(dateSelection) {
  return (
    organization: Organization,
    tableRow: TableDataRow,
    _query: Query
  ): LocationDescriptor => {
    const traceId = `${tableRow.trace}`;
    if (!traceId) {
      return {};
    }

    return getTraceDetailsUrl(organization, traceId, dateSelection, {});
  };
}

function generateTransactionLink(transactionName: string) {
  return (
    organization: Organization,
    tableRow: TableDataRow,
    query: Query
  ): LocationDescriptor => {
    const eventSlug = generateEventSlug(tableRow);
    return getTransactionDetailsUrl(organization, eventSlug, transactionName, query);
  };
}

function getFilterOptions({p95}: {p95: number}): DropdownOption[] {
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

function getTransactionsListSort(
  location: Location,
  options: {p95: number}
): {selected: DropdownOption; options: DropdownOption[]} {
  const sortOptions = getFilterOptions(options);
  const urlParam = decodeScalar(
    location.query.showTransactions,
    TransactionFilterOptions.SLOW
  );
  const selectedSort = sortOptions.find(opt => opt.value === urlParam) || sortOptions[0];
  return {selected: selectedSort, options: sortOptions};
}

const StyledSearchBar = styled(SearchBar)`
  margin-bottom: ${space(3)};
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
